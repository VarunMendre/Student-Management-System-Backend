import { pool } from "../config/db.js";

let hasParticularsColumnCache = null;

const hasParticularsColumn = async (connection = pool) => {
    if (hasParticularsColumnCache !== null) return hasParticularsColumnCache;
    const [rows] = await connection.query(
        `SELECT COUNT(*) as count
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'fee_transactions'
           AND COLUMN_NAME = 'particulars'`
    );
    hasParticularsColumnCache = Number(rows[0]?.count || 0) > 0;
    return hasParticularsColumnCache;
};

const findLedgerById = async (ledgerId) => {
    const [rows] = await pool.query(
        "SELECT id, student_id, academic_year, academic_year_num, total_yearly_fee, total_paid, pending_fee, status FROM student_fee_ledger WHERE id = ?",
        [ledgerId]
    );
    return rows[0];
};

const insertTransaction = async (connection, data) => {
    const { studentId, ledger_id, amount_paid, fee_applied_amount, payment_mode, payment_reference, receiptNumber, remarks, particulars, transaction_date } = data;
    const canStoreParticulars = await hasParticularsColumn(connection);
    const [result] = canStoreParticulars
        ? await connection.query(
            `INSERT INTO fee_transactions (student_id, ledger_id, amount_paid, payment_mode, payment_reference, receipt_number, remarks, particulars, transaction_date, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [studentId, ledger_id, amount_paid, payment_mode, payment_reference, receiptNumber, remarks, JSON.stringify(particulars || []), transaction_date || new Date().toISOString().slice(0, 10), null]
        )
        : await connection.query(
            `INSERT INTO fee_transactions (student_id, ledger_id, amount_paid, payment_mode, payment_reference, receipt_number, remarks, transaction_date, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [studentId, ledger_id, amount_paid, payment_mode, payment_reference, receiptNumber, remarks, transaction_date || new Date().toISOString().slice(0, 10), null]
        );
    
    const [rows] = await connection.query(
        `SELECT id, receipt_number, amount_paid, payment_mode, payment_reference, DATE_FORMAT(transaction_date, '%Y-%m-%d') as transaction_date, remarks, ${canStoreParticulars ? "particulars" : "NULL as particulars"}, created_at FROM fee_transactions WHERE id = ?`,
        [result.insertId]
    );
    return { ...rows[0], fee_applied_amount };
};

const updateLedgerTotalPaid = async (connection, ledgerId, totalPaid, status) => {
    await connection.query(
        `UPDATE student_fee_ledger 
         SET total_paid = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [totalPaid, status, ledgerId]
    );
    
    const [rows] = await connection.query(
        `SELECT id as ledger_id, academic_year, academic_year_num, total_yearly_fee, total_paid, pending_fee, status FROM student_fee_ledger WHERE id = ?`,
        [ledgerId]
    );
    return rows[0];
};

const findTransactionsByStudent = async (studentId, yearNum) => {
    const canReadParticulars = await hasParticularsColumn();
    let query = `
        SELECT 
            ft.id, ft.ledger_id, ft.amount_paid, ft.payment_mode, ft.payment_reference,
            ft.receipt_number, sfl.academic_year, sfl.academic_year_num, ft.remarks, ${canReadParticulars ? "ft.particulars" : "NULL as particulars"},
            DATE_FORMAT(ft.transaction_date, '%Y-%m-%d') as transaction_date, 
            ft.created_at, ft.status
        FROM fee_transactions ft
        JOIN student_fee_ledger sfl ON ft.ledger_id = sfl.id
        WHERE ft.student_id = ?
          AND ft.status = 'Active'
    `;
    const values = [studentId];
    if (yearNum) {
        query += ` AND sfl.academic_year_num = ?`;
        values.push(yearNum);
    }
    query += ` ORDER BY ft.created_at DESC`;
    const [rows] = await pool.query(query, values);
    return rows;
};

const findTransactionWithDetails = async (txnId, studentId) => {
    const canReadParticulars = await hasParticularsColumn();
    const [rows] = await pool.query(
        `SELECT 
            ft.receipt_number, ft.ledger_id,
            s.full_name as student_name, s.email,
            c.course_name, cb.batch_name,
            sfl.academic_year,
            ft.amount_paid, ft.payment_mode, ft.payment_reference,
            DATE_FORMAT(ft.transaction_date, '%Y-%m-%d') as transaction_date, 
            ft.remarks, ${canReadParticulars ? "ft.particulars" : "NULL as particulars"}, ft.created_by, ft.created_at
         FROM fee_transactions ft
         JOIN students s ON ft.student_id = s.id
         JOIN courses c ON s.course_id = c.id
         JOIN course_batches cb ON s.batch_id = cb.id
         JOIN student_fee_ledger sfl ON ft.ledger_id = sfl.id
         WHERE ft.id = ? AND ft.student_id = ?`,
        [txnId, studentId]
    );
    return rows[0];
};

const findFullLedgerByStudent = async (studentId) => {
    const [rows] = await pool.query(
        `SELECT id as ledger_id, academic_year, academic_year_num, total_yearly_fee, total_paid, pending_fee, status
         FROM student_fee_ledger
         WHERE student_id = ?
         ORDER BY academic_year_num ASC`,
        [studentId]
    );
    return rows;
};

const getStudentWithCourse = async (studentId) => {
    const [rows] = await pool.query(
        `SELECT s.id, s.full_name, c.course_name
         FROM students s
         JOIN courses c ON s.course_id = c.id
         WHERE s.id = ?`,
        [studentId]
    );
    return rows[0];
};

const findAllTransactions = async (params = {}) => {
    const canReadParticulars = await hasParticularsColumn();
    const normalizedDate = params.date || params.transaction_date || null;
    const normalizedStartDate = params.startDate || params.fromDate || params.start_date || null;
    const normalizedEndDate = params.endDate || params.toDate || params.end_date || null;
    const normalizedPaymentMode = params.paymentMode || params.payment_mode || null;

    let whereClause = ` WHERE ft.status = 'Active'`;
    const values = [];

    if (normalizedDate) {
        whereClause += ` AND ft.transaction_date = ?`;
        values.push(normalizedDate);
    }

    if (normalizedStartDate && normalizedEndDate) {
        whereClause += ` AND ft.transaction_date BETWEEN ? AND ?`;
        values.push(normalizedStartDate, normalizedEndDate);
    }

    if (normalizedPaymentMode) {
        whereClause += ` AND ft.payment_mode = ?`;
        values.push(normalizedPaymentMode);
    }

    const baseFromJoin = `
        FROM fee_transactions ft
        JOIN students s ON ft.student_id = s.id
        JOIN courses c ON s.course_id = c.id
        JOIN course_batches cb ON s.batch_id = cb.id
        JOIN student_fee_ledger sfl ON ft.ledger_id = sfl.id
    `;

    // Count query
    const [countRows] = await pool.query(`SELECT COUNT(*) as total ${baseFromJoin} ${whereClause}`, values);
    const total = parseInt(countRows[0].total);

    // Data query
    let dataQuery = `
        SELECT 
            ft.id, ft.student_id as studentId, ft.amount_paid as paidAmount, ft.payment_mode as paymentMode, ft.payment_reference as referenceNo,
            ft.receipt_number as receiptNo, DATE_FORMAT(ft.transaction_date, '%Y-%m-%d') as date, ft.remarks, ${canReadParticulars ? "ft.particulars" : "NULL as particulars"}, ft.created_at as createdAt, ft.created_by as recordedBy,
            s.full_name as studentName, c.course_name as courseName, cb.batch_name as batchName, sfl.academic_year as year,
            s.mobile_number as studentMobile, s.gender as studentGender, s.caste_category as studentCaste, s.prn_number as prnNumber
        ${baseFromJoin}
        ${whereClause}
        ORDER BY ft.created_at DESC
    `;

    const paginationValues = [...values];
    if (params.limit !== undefined) {
        dataQuery += ` LIMIT ?`;
        paginationValues.push(parseInt(params.limit));
    }
    if (params.offset !== undefined) {
        dataQuery += ` OFFSET ?`;
        paginationValues.push(parseInt(params.offset));
    }

    const [rows] = await pool.query(dataQuery, paginationValues);
    return { transactions: rows, total };
};

const getLedgerByStudentAndYearNum = async (studentId, yearNum) => {
    const [rows] = await pool.query(
        `SELECT id as ledger_id, academic_year, academic_year_num, total_yearly_fee, total_paid, pending_fee, status
         FROM student_fee_ledger
         WHERE student_id = ? AND academic_year_num = ?
         LIMIT 1`,
        [studentId, yearNum]
    );
    return rows[0] || null;
};

const getOverCollectionForYear = async () => 0;
const getOverCollectionDetailsForYear = async () => [];
const getOverCollectionFromYear = async () => 0;
const getOverCollectionDetailsFromYear = async () => [];

const getFeeParticularsForLedger = async (ledgerId) => {
    const [rows] = await pool.query(
        `SELECT cf.component_name, cf.amount
         FROM student_fee_ledger sfl
         JOIN students s ON s.id = sfl.student_id
         JOIN course_fees cf ON cf.batch_id = s.batch_id
         WHERE sfl.id = ?
           AND (
             cf.normalized_year = sfl.academic_year
             OR cf.component_name LIKE CONCAT(sfl.academic_year, ' - %')
           )
         ORDER BY cf.id ASC`,
        [ledgerId]
    );
    return rows.map((row) => ({
        name: String(row.component_name || "").split(" - ").slice(1).join(" - ") || row.component_name,
        amount: parseFloat(row.amount || 0)
    }));
};

const getOverCollectionHistory = async () => [];

export default {
    findLedgerById,
    insertTransaction,
    updateLedgerTotalPaid,
    findTransactionsByStudent,
    findTransactionWithDetails,
    findFullLedgerByStudent,
    getStudentWithCourse,
    findAllTransactions,
    getLedgerByStudentAndYearNum,
    getOverCollectionForYear,
    getOverCollectionDetailsForYear,
    getOverCollectionFromYear,
    getOverCollectionDetailsFromYear,
    getFeeParticularsForLedger,
    getOverCollectionHistory
};
