import { CustomError, ErrorCodes } from "../utils/customError.js";
import { generateReceiptNumber, amountToWords } from "../utils/receiptGenerator.js";
import paymentModel from "../models/paymentModel.js";
import studentModel from "../models/studentModel.js";
import { withTransaction } from "../utils/dbUtils.js";

const parseParticulars = (value) => {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const sumParticulars = (items = []) => items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

const isGenericParticulars = (particulars) => {
    if (!Array.isArray(particulars) || particulars.length === 0) return true;
    return particulars.some(p => {
        const name = String(p?.name || p || '').trim().toLowerCase();
        return name.startsWith('fees for') || name.startsWith('fees of') || name === 'fee payment' || name === 'fees';
    });
};

const getFallbackParticulars = async (row) => {
    const storedParticulars = parseParticulars(row.particulars);
    const amountPaid = parseFloat(row.amount_paid || 0);

    if (storedParticulars.length > 0 && !isGenericParticulars(storedParticulars)) {
        return storedParticulars;
    }

    const paymentMode = String(row.payment_mode || "").toLowerCase();
    if (paymentMode === "scholarship") {
        return [{ name: row.remarks || "Scholarship", amount: amountPaid }];
    }

    const feeParticulars = await paymentModel.getFeeParticularsForLedger(row.ledger_id);
    if (feeParticulars.length > 0) {
        let remaining = amountPaid;
        const result = [];
        for (const comp of feeParticulars) {
            if (remaining <= 0) break;
            const allocated = Math.min(remaining, comp.amount);
            if (allocated > 0) {
                result.push({ name: comp.name, amount: allocated });
                remaining -= allocated;
            }
        }
        if (remaining > 0) {
            if (result.length > 0) {
                result[result.length - 1].amount += remaining;
            } else {
                result.push({ name: feeParticulars[0].name, amount: remaining });
            }
        }
        return result;
    }

    return [{ name: row.remarks || "Fee Payment", amount: amountPaid }];
};

const createPayment = async (studentId, data) => {
    const { ledger_id, amount_paid, fee_applied_amount, payment_mode, payment_reference, remarks, particulars = [], transaction_date } = data;

    if (!await studentModel.exists(studentId)) throw new CustomError({
        message: "Student not found",
        statusCode: 404,
        code: ErrorCodes.NOT_FOUND
    });

    const ledger = await paymentModel.findLedgerById(ledger_id);
    if (!ledger) throw new CustomError({
        message: "Fee ledger not found",
        statusCode: 404,
        code: ErrorCodes.NOT_FOUND
    });
    if (ledger.student_id !== parseInt(studentId)) throw new CustomError({
        message: "Ledger mismatch",
        statusCode: 400,
        code: ErrorCodes.VALIDATION_ERROR
    });

    const overCollectionFromPrev = await paymentModel.getOverCollectionForYear(studentId, ledger.academic_year_num);
    const adjustedFee = Math.max(0, parseFloat(ledger.total_yearly_fee || 0) - overCollectionFromPrev);
    const pendingFee = Math.max(0, adjustedFee - parseFloat(ledger.total_paid || 0));
    const receiptAmount = parseFloat(amount_paid);
    const appliedAmount = fee_applied_amount === undefined || fee_applied_amount === null
        ? receiptAmount
        : parseFloat(fee_applied_amount);

    if (appliedAmount > pendingFee) throw new CustomError({
        message: `Amount (${appliedAmount}) exceeds pending (${pendingFee})`,
        statusCode: 400,
        code: ErrorCodes.OVERPAYMENT,
        details: {
            amount_paid: appliedAmount,
            pending_fee: pendingFee
        }
    });

    const receiptNumber = await generateReceiptNumber();

    return await withTransaction(async (client) => {
        const transaction = await paymentModel.insertTransaction(client, {
            studentId, ledger_id, amount_paid: receiptAmount, fee_applied_amount: appliedAmount, payment_mode, payment_reference, receiptNumber, remarks, particulars, transaction_date
        });

        const newTotalPaid = parseFloat(ledger.total_paid) + appliedAmount;
        let status = newTotalPaid >= adjustedFee ? "Paid" : (newTotalPaid > 0 ? "Partial" : "Pending");

        const updatedLedger = await paymentModel.updateLedgerTotalPaid(client, ledger_id, newTotalPaid, status);

        return {
            transaction: {
                ...transaction,
                amount_paid: parseFloat(transaction.amount_paid),
                fee_applied_amount: appliedAmount,
                particulars: parseParticulars(transaction.particulars),
                amount_in_words: amountToWords(parseFloat(transaction.amount_paid))
            },
            updated_ledger: {
                ...updatedLedger,
                total_yearly_fee: parseFloat(updatedLedger.total_yearly_fee),
                total_paid: parseFloat(updatedLedger.total_paid),
                pending_fee: Math.max(0, adjustedFee - parseFloat(updatedLedger.total_paid))
            }
        };
    }).catch(error => {
        if (error.code === "23505" && error.constraint?.includes("receipt_number")) throw new CustomError({
            message: "Receipt collision",
            statusCode: 500,
            code: ErrorCodes.DATABASE_ERROR,
            cause: error
        });
        throw error;
    });
};

const getTransactions = async (studentId, filters = {}) => {
    if (!await studentModel.exists(studentId)) throw new CustomError({
        message: "Student not found",
        statusCode: 404,
        code: ErrorCodes.NOT_FOUND
    });
    const rows = await paymentModel.findTransactionsByStudent(studentId, filters.academic_year_num);
    return Promise.all(rows.map(async (row) => {
        return {
            ...row,
            amount_paid: parseFloat(row.amount_paid),
            particulars: await getFallbackParticulars(row)
        };
    }));
};

const getTransactionById = async (studentId, txnId) => {
    const txn = await paymentModel.findTransactionWithDetails(txnId, studentId);
    if (!txn) throw new CustomError({
        message: "Transaction not found",
        statusCode: 404,
        code: ErrorCodes.NOT_FOUND
    });
    return {
        ...txn,
        amount_paid: parseFloat(txn.amount_paid),
        particulars: await getFallbackParticulars(txn),
        amount_in_words: amountToWords(parseFloat(txn.amount_paid))
    };
};

const getFeeLedger = async (studentId) => {
    const student = await paymentModel.getStudentWithCourse(studentId);
    if (!student) throw new CustomError({
        message: "Student not found",
        statusCode: 404,
        code: ErrorCodes.NOT_FOUND
    });

    const ledger = await paymentModel.findFullLedgerByStudent(studentId);
    const parsedLedger = ledger.map(row => ({
        ...row, total_yearly_fee: parseFloat(row.total_yearly_fee), total_paid: parseFloat(row.total_paid), pending_fee: parseFloat(row.pending_fee)
    }));

    return {
        student_id: student.id, student_name: student.full_name, course_name: student.course_name,
        ledger: parsedLedger,
        summary: {
            total_course_fee: parsedLedger.reduce((sum, row) => sum + row.total_yearly_fee, 0),
            total_paid: parsedLedger.reduce((sum, row) => sum + row.total_paid, 0),
            total_pending: parsedLedger.reduce((sum, row) => sum + row.pending_fee, 0)
        }
    };
};

const getAllTransactions = async (filters = {}) => {
    const { transactions, total } = await paymentModel.findAllTransactions(filters);
    const rows = transactions.map(row => ({
        ...row,
        paidAmount: parseFloat(row.paidAmount || 0)
    }));
    return { transactions: rows, total };
};

const getStudentFeeOverview = async (studentId, academicYearNum) => {
    if (!await studentModel.exists(studentId)) throw new CustomError({
        message: "Student not found",
        statusCode: 404,
        code: ErrorCodes.NOT_FOUND
    });
    const yearNum = Number(academicYearNum || 0);
    if (!yearNum) throw new CustomError({
        message: "academic_year_num is required",
        statusCode: 400,
        code: ErrorCodes.VALIDATION_ERROR
    });
    const ledger = await paymentModel.getLedgerByStudentAndYearNum(studentId, yearNum);
    if (!ledger) throw new CustomError({
        message: "Ledger not found for year",
        statusCode: 404,
        code: ErrorCodes.NOT_FOUND
    });

    const currentYearFee = parseFloat(ledger.total_yearly_fee || 0);
    const ledgerTotalPaid = parseFloat(ledger.total_paid || 0);
    const overCollectionFromPrev = await paymentModel.getOverCollectionForYear(studentId, yearNum);
    const overCollectionDetails = await paymentModel.getOverCollectionDetailsForYear(studentId, yearNum);
    const overCollectionCarriedForward = await paymentModel.getOverCollectionFromYear(studentId, yearNum);
    const overCollectionCarryForwardDetails = await paymentModel.getOverCollectionDetailsFromYear(studentId, yearNum);
    const adjustedFee = Math.max(0, currentYearFee - overCollectionFromPrev);
    const pending = Math.max(0, adjustedFee - ledgerTotalPaid);
    const effectiveTotalPaid = ledgerTotalPaid + overCollectionFromPrev;
    const effectivePending = Math.max(0, currentYearFee - effectiveTotalPaid);

    return {
        academic_year_num: yearNum,
        current_year_fee: currentYearFee,
        over_collection_from_prev: overCollectionFromPrev,
        over_collection_carried_forward: overCollectionCarriedForward,
        adjusted_fee: adjustedFee,
        ledger_total_paid: ledgerTotalPaid,
        total_paid: effectiveTotalPaid,
        effective_total_paid: effectiveTotalPaid,
        pending,
        effective_pending: effectivePending,
        carry_in_credit: overCollectionFromPrev,
        carried_forward_credit: overCollectionCarriedForward,
        over_collection_details: overCollectionDetails,
        over_collection_carry_forward_details: overCollectionCarryForwardDetails
    };
};

const getOverCollectionHistory = async (studentId) => {
    if (!await studentModel.exists(studentId)) throw new CustomError({
        message: "Student not found",
        statusCode: 404,
        code: ErrorCodes.NOT_FOUND
    });
    return paymentModel.getOverCollectionHistory(studentId);
};

export default {
    createPayment,
    getTransactions,
    getTransactionById,
    getFeeLedger,
    getAllTransactions,
    getStudentFeeOverview,
    getOverCollectionHistory
};
