import { pool } from "../config/db.js";

const findLedgerById = async (ledgerId) => {
    const res = await pool.query(
        "SELECT id, student_id, academic_year, total_yearly_fee, total_paid, pending_fee, status FROM student_fee_ledger WHERE id = $1",
        [ledgerId]
    );
    return res.rows[0];
};

const insertTransaction = async (client, data) => {
    const { studentId, ledger_id, amount_paid, payment_mode, payment_reference, receiptNumber, remarks, transaction_date } = data;
    const res = await client.query(
        `INSERT INTO fee_transactions (student_id, ledger_id, amount_paid, payment_mode, payment_reference, receipt_number, remarks, transaction_date, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, receipt_number, amount_paid, payment_mode, payment_reference, TO_CHAR(transaction_date, 'YYYY-MM-DD') as transaction_date, remarks, created_at`,
        [studentId, ledger_id, amount_paid, payment_mode, payment_reference, receiptNumber, remarks, transaction_date || new Date().toISOString().slice(0, 10), null]
    );
    return res.rows[0];
};

const updateLedgerTotalPaid = async (client, ledgerId, totalPaid, status) => {
    const res = await client.query(
        `UPDATE student_fee_ledger 
         SET total_paid = $1, status = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id as ledger_id, academic_year, total_yearly_fee, total_paid, pending_fee, status`,
        [totalPaid, status, ledgerId]
    );
    return res.rows[0];
};

const findTransactionsByStudent = async (studentId, yearNum) => {
    let query = `
        SELECT 
            ft.id, ft.amount_paid, ft.payment_mode, ft.payment_reference,
            ft.receipt_number, sfl.academic_year, ft.remarks,
            TO_CHAR(ft.transaction_date, 'YYYY-MM-DD') as transaction_date, 
            ft.created_at, ft.status
        FROM fee_transactions ft
        JOIN student_fee_ledger sfl ON ft.ledger_id = sfl.id
        WHERE ft.student_id = $1
          AND ft.status = 'Active'
    `;
    const values = [studentId];
    if (yearNum) {
        query += ` AND sfl.academic_year_num = $2`;
        values.push(yearNum);
    }
    query += ` ORDER BY ft.created_at DESC`;
    const { rows } = await pool.query(query, values);
    return rows;
};

const findTransactionWithDetails = async (txnId, studentId) => {
    const res = await pool.query(
        `SELECT 
            ft.receipt_number, 
            s.full_name as student_name, s.email,
            c.course_name, cb.batch_name,
            sfl.academic_year,
            ft.amount_paid, ft.payment_mode, ft.payment_reference,
            TO_CHAR(ft.transaction_date, 'YYYY-MM-DD') as transaction_date, 
            ft.remarks, ft.created_by, ft.created_at
         FROM fee_transactions ft
         JOIN students s ON ft.student_id = s.id
         JOIN courses c ON s.course_id = c.id
         JOIN course_batches cb ON s.batch_id = cb.id
         JOIN student_fee_ledger sfl ON ft.ledger_id = sfl.id
         WHERE ft.id = $1 AND ft.student_id = $2`,
        [txnId, studentId]
    );
    return res.rows[0];
};

const findFullLedgerByStudent = async (studentId) => {
    const res = await pool.query(
        `SELECT id as ledger_id, academic_year, academic_year_num, total_yearly_fee, total_paid, pending_fee, status
         FROM student_fee_ledger
         WHERE student_id = $1
         ORDER BY academic_year_num ASC`,
        [studentId]
    );
    return res.rows;
};

const getStudentWithCourse = async (studentId) => {
    const res = await pool.query(
        `SELECT s.id, s.full_name, c.course_name
         FROM students s
         JOIN courses c ON s.course_id = c.id
         WHERE s.id = $1`,
        [studentId]
    );
    return res.rows[0];
};

const findAllTransactions = async (params = {}) => {
    const normalizedDate = params.date || params.transaction_date || null;
    const normalizedStartDate = params.startDate || params.fromDate || params.start_date || null;
    const normalizedEndDate = params.endDate || params.toDate || params.end_date || null;
    const normalizedPaymentMode = params.paymentMode || params.payment_mode || null;

    let query = `
        FROM fee_transactions ft
        JOIN students s ON ft.student_id = s.id
        JOIN courses c ON s.course_id = c.id
        JOIN course_batches cb ON s.batch_id = cb.id
        JOIN student_fee_ledger sfl ON ft.ledger_id = sfl.id
        WHERE ft.status = 'Active'
    `;
    const values = [];
    let i = 1;

    if (normalizedDate) {
        query += ` AND ft.transaction_date = $${i++}`;
        values.push(normalizedDate);
    }

    if (normalizedStartDate && normalizedEndDate) {
        query += ` AND ft.transaction_date BETWEEN $${i++} AND $${i++}`;
        values.push(normalizedStartDate, normalizedEndDate);
    }

    if (normalizedPaymentMode) {
        query += ` AND ft.payment_mode = $${i++}`;
        values.push(normalizedPaymentMode);
    }

    // Count query
    const countQuery = `SELECT COUNT(*) as total ${query}`;
    const { rows: countRows } = await pool.query(countQuery, values);
    const total = parseInt(countRows[0].total);

    // Data query with ordering and pagination
    let dataQuery = `
        SELECT 
            ft.id, ft.student_id as "studentId", ft.amount_paid as "paidAmount", ft.payment_mode as "paymentMode", ft.payment_reference as "referenceNo",
            ft.receipt_number as "receiptNo", TO_CHAR(ft.transaction_date, 'YYYY-MM-DD') as "date", ft.remarks, ft.created_at as "createdAt", ft.created_by as "recordedBy",
            s.full_name as "studentName", c.course_name as "courseName", cb.batch_name as "batchName", sfl.academic_year as "year",
            s.mobile_number as "studentMobile", s.gender as "studentGender", s.caste_category as "studentCaste", s.prn_number as "prnNumber"
        ${query}
        ORDER BY ft.created_at DESC
    `;

    if (params.limit !== undefined) {
        dataQuery += ` LIMIT $${i++}`;
        values.push(parseInt(params.limit));
    }
    if (params.offset !== undefined) {
        dataQuery += ` OFFSET $${i++}`;
        values.push(parseInt(params.offset));
    }

    const { rows } = await pool.query(dataQuery, values);
    return { transactions: rows, total };
};

export default {
    findLedgerById,
    insertTransaction,
    updateLedgerTotalPaid,
    findTransactionsByStudent,
    findTransactionWithDetails,
    findFullLedgerByStudent,
    getStudentWithCourse,
    findAllTransactions
};
