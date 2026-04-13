import { CustomError } from "../utils/customError.js";
import { generateReceiptNumber, amountToWords } from "../utils/receiptGenerator.js";
import paymentModel from "../models/paymentModel.js";
import studentModel from "../models/studentModel.js";
import { withTransaction } from "../utils/dbUtils.js";

const createPayment = async (studentId, data) => {
    const { ledger_id, amount_paid, payment_mode, payment_reference, remarks, transaction_date } = data;

    if (!await studentModel.exists(studentId)) throw new CustomError("Student not found", 404);

    const ledger = await paymentModel.findLedgerById(ledger_id);
    if (!ledger) throw new CustomError("Fee ledger not found", 404);
    if (ledger.student_id !== parseInt(studentId)) throw new CustomError("Ledger mismatch", 400);

    const pendingFee = parseFloat(ledger.pending_fee);
    if (amount_paid > pendingFee) throw new CustomError(`Amount (₹${amount_paid}) exceeds pending (₹${pendingFee})`, 400);

    const receiptNumber = await generateReceiptNumber();
    
    return await withTransaction(async (client) => {
        const transaction = await paymentModel.insertTransaction(client, {
            studentId, ledger_id, amount_paid, payment_mode, payment_reference, receiptNumber, remarks, transaction_date
        });

        const newTotalPaid = parseFloat(ledger.total_paid) + amount_paid;
        const totalYearlyFee = parseFloat(ledger.total_yearly_fee);
        let status = newTotalPaid >= totalYearlyFee ? "Paid" : (newTotalPaid > 0 ? "Partial" : "Pending");

        const updatedLedger = await paymentModel.updateLedgerTotalPaid(client, ledger_id, newTotalPaid, status);

        return {
            transaction: { ...transaction, amount_paid: parseFloat(transaction.amount_paid) },
            updated_ledger: { ...updatedLedger, total_yearly_fee: parseFloat(updatedLedger.total_yearly_fee), total_paid: parseFloat(updatedLedger.total_paid), pending_fee: parseFloat(updatedLedger.pending_fee) }
        };
    }).catch(error => {
        if (error.code === "23505" && error.constraint?.includes("receipt_number")) throw new CustomError("Receipt collision", 500);
        throw error;
    });
};

const getTransactions = async (studentId, filters = {}) => {
    if (!await studentModel.exists(studentId)) throw new CustomError("Student not found", 404);
    const rows = await paymentModel.findTransactionsByStudent(studentId, filters.academic_year_num);
    return rows.map(row => ({ ...row, amount_paid: parseFloat(row.amount_paid) }));
};

const getTransactionById = async (studentId, txnId) => {
    const txn = await paymentModel.findTransactionWithDetails(txnId, studentId);
    if (!txn) throw new CustomError("Transaction not found", 404);
    return { ...txn, amount_paid: parseFloat(txn.amount_paid), amount_in_words: amountToWords(parseFloat(txn.amount_paid)) };
};

const getFeeLedger = async (studentId) => {
    const student = await paymentModel.getStudentWithCourse(studentId);
    if (!student) throw new CustomError("Student not found", 404);

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

export default { createPayment, getTransactions, getTransactionById, getFeeLedger };
