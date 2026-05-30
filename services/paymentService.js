import { CustomError, ErrorCodes } from "../utils/customError.js";
import { generateReceiptNumber, amountToWords } from "../utils/receiptGenerator.js";
import paymentModel from "../models/paymentModel.js";
import studentModel from "../models/studentModel.js";
import { withTransaction } from "../utils/dbUtils.js";

const calculateCascadingLedgers = (ledgers) => {
    let carry = 0;
    return ledgers.map(ledger => {
        const totalFee = parseFloat(ledger.total_yearly_fee || 0);
        const directPaid = parseFloat(ledger.total_paid || 0);
        const effectivePaid = directPaid + carry;
        const appliedToFee = Math.min(effectivePaid, totalFee);
        const balance = totalFee - appliedToFee;
        carry = effectivePaid - appliedToFee;

        return {
            ...ledger,
            total_yearly_fee: totalFee,
            total_paid: directPaid,
            effective_paid: effectivePaid,
            applied_to_fee: appliedToFee,
            pending_fee: balance,
            carry_out: carry,
            carry_in: effectivePaid - directPaid,
            status: balance <= 0 ? "Paid" : (effectivePaid > 0 ? "Partial" : "Pending")
        };
    });
};

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

    const receiptAmount = parseFloat(amount_paid);
    const appliedAmount = fee_applied_amount === undefined || fee_applied_amount === null
        ? receiptAmount
        : parseFloat(fee_applied_amount);

    const receiptNumber = await generateReceiptNumber();

    return await withTransaction(async (client) => {
        const transaction = await paymentModel.insertTransaction(client, {
            studentId, ledger_id, amount_paid: receiptAmount, fee_applied_amount: appliedAmount, payment_mode, payment_reference, receiptNumber, remarks, particulars, transaction_date
        });

        const newTotalPaid = parseFloat(ledger.total_paid) + appliedAmount;
        let status = newTotalPaid >= parseFloat(ledger.total_yearly_fee) ? "Paid" : (newTotalPaid > 0 ? "Partial" : "Pending");

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
                pending_fee: Math.max(0, parseFloat(updatedLedger.total_yearly_fee) - parseFloat(updatedLedger.total_paid))
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
    const parsedLedger = calculateCascadingLedgers(ledger);

    return {
        student_id: student.id, student_name: student.full_name, course_name: student.course_name,
        ledger: parsedLedger,
        summary: {
            total_course_fee: parsedLedger.reduce((sum, row) => sum + row.total_yearly_fee, 0),
            total_paid: parsedLedger.reduce((sum, row) => sum + row.applied_to_fee, 0),
            total_pending: parsedLedger.reduce((sum, row) => sum + row.pending_fee, 0),
            global_over_collection: parsedLedger.length > 0 ? parsedLedger[parsedLedger.length - 1].carry_out : 0
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
    const allLedgers = await paymentModel.findFullLedgerByStudent(studentId);
    const cascadedLedgers = calculateCascadingLedgers(allLedgers);
    const yearLedger = cascadedLedgers.find(l => l.academic_year_num === yearNum);

    if (!yearLedger) throw new CustomError({
        message: "Ledger not found for year",
        statusCode: 404,
        code: ErrorCodes.NOT_FOUND
    });

    return {
        academic_year_num: yearNum,
        current_year_fee: yearLedger.total_yearly_fee,
        over_collection_from_prev: yearLedger.carry_in,
        over_collection_carried_forward: yearLedger.carry_out,
        adjusted_fee: yearLedger.total_yearly_fee,
        ledger_total_paid: yearLedger.total_paid,
        total_paid: yearLedger.effective_paid,
        effective_total_paid: yearLedger.effective_paid,
        pending: yearLedger.pending_fee,
        effective_pending: yearLedger.pending_fee,
        carry_in_credit: yearLedger.carry_in,
        carried_forward_credit: yearLedger.carry_out,
        applied_to_fee: yearLedger.applied_to_fee,
        global_over_collection: cascadedLedgers[cascadedLedgers.length - 1].carry_out,
        over_collection_details: [],
        over_collection_carry_forward_details: []
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
