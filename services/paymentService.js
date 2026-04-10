import { pool } from "../config/db.js";
import { CustomError } from "../utils/customError.js";
import { generateReceiptNumber, amountToWords } from "../utils/receiptGenerator.js";

/**
 * Record a fee payment.
 * Transactional: Creates fee_transaction + updates student_fee_ledger.total_paid & status.
 */
const createPayment = async (studentId, data) => {
    const { ledger_id, amount_paid, payment_mode, payment_reference, remarks, transaction_date } = data;

    // 1. Verify student exists
    const studentRes = await pool.query("SELECT id FROM students WHERE id = $1", [studentId]);
    if (studentRes.rows.length === 0) {
        throw new CustomError("Student not found", 404);
    }

    // 2. Verify ledger exists and belongs to this student
    const ledgerRes = await pool.query(
        "SELECT id, student_id, academic_year, total_yearly_fee, total_paid, pending_fee, status FROM student_fee_ledger WHERE id = $1",
        [ledger_id]
    );

    if (ledgerRes.rows.length === 0) {
        throw new CustomError("Fee ledger not found", 404);
    }

    const ledger = ledgerRes.rows[0];

    if (ledger.student_id !== parseInt(studentId)) {
        throw new CustomError("Fee ledger does not belong to this student", 400);
    }

    // 3. Overpayment guard
    const pendingFee = parseFloat(ledger.pending_fee);
    if (amount_paid > pendingFee) {
        throw new CustomError(
            `Payment amount (₹${amount_paid}) exceeds pending fee (₹${pendingFee}). Maximum allowed: ₹${pendingFee}`,
            400
        );
    }

    // 4. Generate receipt number
    const receiptNumber = await generateReceiptNumber();

    // 5. Begin transaction
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Insert the fee transaction
        const txnRes = await client.query(
            `INSERT INTO fee_transactions (student_id, ledger_id, amount_paid, payment_mode, payment_reference, receipt_number, remarks, transaction_date, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, receipt_number, amount_paid, payment_mode, payment_reference, transaction_date, remarks, created_at`,
            [studentId, ledger_id, amount_paid, payment_mode, payment_reference, receiptNumber, remarks, transaction_date || new Date().toISOString().slice(0, 10), null]
        );

        const transaction = txnRes.rows[0];

        // Update the ledger: total_paid += amount_paid
        const newTotalPaid = parseFloat(ledger.total_paid) + amount_paid;
        const totalYearlyFee = parseFloat(ledger.total_yearly_fee);

        // Determine new status
        let newStatus = "Pending";
        if (newTotalPaid >= totalYearlyFee) {
            newStatus = "Paid";
        } else if (newTotalPaid > 0) {
            newStatus = "Partial";
        }

        const updatedLedgerRes = await client.query(
            `UPDATE student_fee_ledger 
             SET total_paid = $1, status = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING id as ledger_id, academic_year, total_yearly_fee, total_paid, pending_fee, status`,
            [newTotalPaid, newStatus, ledger_id]
        );

        await client.query("COMMIT");

        return {
            transaction: {
                id: transaction.id,
                receipt_number: transaction.receipt_number,
                amount_paid: parseFloat(transaction.amount_paid),
                payment_mode: transaction.payment_mode,
                payment_reference: transaction.payment_reference,
                transaction_date: transaction.transaction_date
            },
            updated_ledger: {
                ...updatedLedgerRes.rows[0],
                total_yearly_fee: parseFloat(updatedLedgerRes.rows[0].total_yearly_fee),
                total_paid: parseFloat(updatedLedgerRes.rows[0].total_paid),
                pending_fee: parseFloat(updatedLedgerRes.rows[0].pending_fee)
            }
        };

    } catch (error) {
        await client.query("ROLLBACK");

        // Handle unique receipt_number collision (extremely rare, but safe)
        if (error.code === "23505" && error.constraint?.includes("receipt_number")) {
            throw new CustomError("Receipt number collision. Please retry the payment.", 500);
        }
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Get all transactions for a student, optionally filtered by academic year.
 */
const getTransactions = async (studentId, filters = {}) => {
    // Verify student exists
    const studentRes = await pool.query("SELECT id FROM students WHERE id = $1", [studentId]);
    if (studentRes.rows.length === 0) {
        throw new CustomError("Student not found", 404);
    }

    let query = `
        SELECT 
            ft.id, ft.amount_paid, ft.payment_mode, ft.payment_reference,
            ft.receipt_number, sfl.academic_year, ft.remarks,
            ft.transaction_date, ft.created_by, ft.created_at
        FROM fee_transactions ft
        JOIN student_fee_ledger sfl ON ft.ledger_id = sfl.id
        WHERE ft.student_id = $1
    `;

    const values = [studentId];

    if (filters.academic_year_num) {
        query += ` AND sfl.academic_year_num = $2`;
        values.push(filters.academic_year_num);
    }

    query += ` ORDER BY ft.created_at DESC`;

    const { rows } = await pool.query(query, values);

    return rows.map(row => ({
        ...row,
        amount_paid: parseFloat(row.amount_paid)
    }));
};

/**
 * Get a single transaction by ID (for receipt printing).
 * Includes student info, course info, and amount in words.
 */
const getTransactionById = async (studentId, txnId) => {
    const { rows } = await pool.query(
        `SELECT 
            ft.receipt_number, 
            s.full_name as student_name, s.email,
            c.course_name, cb.batch_name,
            sfl.academic_year,
            ft.amount_paid, ft.payment_mode, ft.payment_reference,
            ft.transaction_date, ft.remarks, ft.created_by, ft.created_at
         FROM fee_transactions ft
         JOIN students s ON ft.student_id = s.id
         JOIN courses c ON s.course_id = c.id
         JOIN course_batches cb ON s.batch_id = cb.id
         JOIN student_fee_ledger sfl ON ft.ledger_id = sfl.id
         WHERE ft.id = $1 AND ft.student_id = $2`,
        [txnId, studentId]
    );

    if (rows.length === 0) {
        throw new CustomError("Transaction not found", 404);
    }

    const txn = rows[0];

    return {
        receipt_number: txn.receipt_number,
        student_name: txn.student_name,
        email: txn.email,
        course_name: txn.course_name,
        batch_name: txn.batch_name,
        academic_year: txn.academic_year,
        amount_paid: parseFloat(txn.amount_paid),
        amount_in_words: amountToWords(parseFloat(txn.amount_paid)),
        payment_mode: txn.payment_mode,
        payment_reference: txn.payment_reference,
        transaction_date: txn.transaction_date,
        remarks: txn.remarks,
        created_by: txn.created_by,
        created_at: txn.created_at
    };
};

/**
 * Get fee ledger (yearly breakdown) for a student.
 */
const getFeeLedger = async (studentId) => {
    // Verify student exists and get basic info
    const studentRes = await pool.query(
        `SELECT s.id, s.full_name, c.course_name
         FROM students s
         JOIN courses c ON s.course_id = c.id
         WHERE s.id = $1`,
        [studentId]
    );

    if (studentRes.rows.length === 0) {
        throw new CustomError("Student not found", 404);
    }

    const student = studentRes.rows[0];

    // Fetch all ledger rows
    const ledgerRes = await pool.query(
        `SELECT id as ledger_id, academic_year, academic_year_num, total_yearly_fee, total_paid, pending_fee, status
         FROM student_fee_ledger
         WHERE student_id = $1
         ORDER BY academic_year_num ASC`,
        [studentId]
    );

    const ledger = ledgerRes.rows.map(row => ({
        ...row,
        total_yearly_fee: parseFloat(row.total_yearly_fee),
        total_paid: parseFloat(row.total_paid),
        pending_fee: parseFloat(row.pending_fee)
    }));

    // Calculate summary
    const totalCourseFee = ledger.reduce((sum, row) => sum + row.total_yearly_fee, 0);
    const totalPaid = ledger.reduce((sum, row) => sum + row.total_paid, 0);
    const totalPending = ledger.reduce((sum, row) => sum + row.pending_fee, 0);

    return {
        student_id: student.id,
        student_name: student.full_name,
        course_name: student.course_name,
        ledger,
        summary: {
            total_course_fee: totalCourseFee,
            total_paid: totalPaid,
            total_pending: totalPending
        }
    };
};

export default { createPayment, getTransactions, getTransactionById, getFeeLedger };
