import { pool } from "../config/db.js";

/**
 * Scholarship Data Access Layer
 */

const getConfigByCourse = async (courseId) => {
    const { rows } = await pool.query(
        "SELECT * FROM course_scholarship_config WHERE course_id = $1 AND is_active = TRUE",
        [courseId]
    );
    return rows;
};

const upsertConfig = async (client, courseId, caste, gender, amount) => {
    await client.query(`
        INSERT INTO course_scholarship_config (course_id, caste_category, gender, max_amount)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (course_id, caste_category, gender) 
        DO UPDATE SET max_amount = EXCLUDED.max_amount, is_active = TRUE
    `, [courseId, caste, gender, amount]);
};

const getStudentAndLedgerForUpdate = async (client, studentId, yearNum) => {
    const res = await client.query(`
        SELECT s.id, s.course_id, s.caste_category, s.gender, s.full_name,
               sfl.id as ledger_id, sfl.pending_fee, sfl.total_paid, sfl.total_yearly_fee
        FROM students s
        JOIN student_fee_ledger sfl ON s.id = sfl.student_id
        WHERE s.id = $1 AND sfl.academic_year_num = $2
        FOR UPDATE OF sfl
    `, [studentId, yearNum]);
    return res.rows[0];
};

const checkDuplicateDisbursal = async (client, studentId, appId, instNo) => {
    const res = await client.query(`
        SELECT id FROM fee_transactions 
        WHERE student_id = $1 AND application_id = $2 AND installment_no = $3 
        AND payment_mode = 'Scholarship' AND status = 'Active'
    `, [studentId, appId, instNo]);
    return res.rows.length > 0;
};

const getScholarshipConfig = async (client, courseId, category, gender) => {
    const res = await client.query(`
        SELECT max_amount FROM course_scholarship_config
        WHERE course_id = $1 AND caste_category = $2 AND gender = $3 AND is_active = TRUE
    `, [courseId, category, gender]);
    return res.rows[0];
};

const getTotalScholarshipReceived = async (client, ledgerId) => {
    const res = await client.query(`
        SELECT COALESCE(SUM(amount_paid), 0) as total 
        FROM fee_transactions 
        WHERE ledger_id = $1 AND payment_mode = 'Scholarship' AND status = 'Active'
    `, [ledgerId]);
    return parseFloat(receivedRes.rows[0].total); // Wait, variable name mismatch in my thought, fixing below
};

// Fixing above
const getTotalReceived = async (client, ledgerId) => {
    const res = await client.query(`
        SELECT COALESCE(SUM(amount_paid), 0) as total 
        FROM fee_transactions 
        WHERE ledger_id = $1 AND payment_mode = 'Scholarship' AND status = 'Active'
    `, [ledgerId]);
    return parseFloat(res.rows[0].total);
};

const createTransaction = async (client, data) => {
    const { student_id, ledger_id, amount, mode, reference, receiptNumber, remarks, appId, instNo } = data;
    const res = await client.query(`
        INSERT INTO fee_transactions (
            student_id, ledger_id, amount_paid, payment_mode, 
            payment_reference, receipt_number, remarks, 
            application_id, installment_no, transaction_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE)
        RETURNING id, receipt_number
    `, [student_id, ledger_id, amount, mode, reference, receiptNumber, remarks, appId, instNo]);
    return res.rows[0];
};

const updateLedgerStatus = async (client, ledgerId, paid, status) => {
    await client.query(`
        UPDATE student_fee_ledger
        SET total_paid = $1, status = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
    `, [paid, status, ledgerId]);
};

const getSummary = async () => {
    const { rows } = await pool.query(`
        SELECT d.name as department_name, c.course_name, COUNT(ft.id) as total_disbursals, SUM(ft.amount_paid) as total_amount
        FROM fee_transactions ft
        JOIN student_fee_ledger sfl ON ft.ledger_id = sfl.id
        JOIN students s ON ft.student_id = s.id
        JOIN courses c ON s.course_id = c.id
        JOIN departments d ON c.department_id = d.id
        WHERE ft.payment_mode = 'Scholarship' AND ft.status = 'Active'
        GROUP BY d.name, c.course_name
        ORDER BY total_amount DESC
    `);
    return rows;
};

const getTransactionWithLedger = async (client, txnId) => {
    const res = await client.query(`
        SELECT ft.*, sfl.total_paid, sfl.total_yearly_fee
        FROM fee_transactions ft
        JOIN student_fee_ledger sfl ON ft.ledger_id = sfl.id
        WHERE ft.id = $1 AND ft.payment_mode = 'Scholarship' FOR UPDATE OF sfl
    `, [txnId]);
    return res.rows[0];
};

const markAsReversed = async (client, txnId) => {
    await client.query("UPDATE fee_transactions SET status = 'Reversed' WHERE id = $1", [txnId]);
};

export default {
    getConfigByCourse,
    upsertConfig,
    getStudentAndLedgerForUpdate,
    checkDuplicateDisbursal,
    getScholarshipConfig,
    getTotalReceived,
    createTransaction,
    updateLedgerStatus,
    getSummary,
    getTransactionWithLedger,
    markAsReversed
};
