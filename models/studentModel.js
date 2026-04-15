import { pool } from "../config/db.js";

const getBatchWithDetails = async (batchId) => {
    const res = await pool.query(
        `SELECT cb.id, cb.course_id, cb.batch_name, cb.total_seats, cb.is_active, 
                c.duration, c.course_name, d.name as department_name 
         FROM course_batches cb 
         JOIN courses c ON cb.course_id = c.id 
         JOIN departments d ON c.department_id = d.id 
         WHERE cb.id = $1`,
        [batchId]
    );
    return res.rows[0];
};

const getCourseDeptId = async (courseId) => {
    const res = await pool.query("SELECT department_id FROM courses WHERE id = $1", [courseId]);
    return res.rows[0];
};

const getEnrolledCount = async (batchId) => {
    const res = await pool.query(
        "SELECT COUNT(*) as enrolled FROM students WHERE batch_id = $1 AND enrollment_status = 'Active'",
        [batchId]
    );
    return parseInt(res.rows[0].enrolled);
};

const getBatchFeesByYear = async (batchId) => {
    const res = await pool.query(
        "SELECT component_name, amount FROM course_fees WHERE batch_id = $1",
        [batchId]
    );
    const fees = {};
    res.rows.forEach(r => {
        const year = r.component_name.split(' - ')[0]; // Extract "FY", "SY", etc.
        fees[year] = (fees[year] || 0) + parseFloat(r.amount);
    });
    return fees;
};

const createStudent = async (client, data) => {
    const { 
        full_name, email, mobile_number, alternate_number, 
        prn_number, eligibility_number, department_id, 
        course_id, batch_id, caste_category, gender 
    } = data;
    
    const res = await client.query(
        `INSERT INTO students (full_name, email, mobile_number, alternate_number, prn_number, eligibility_number, department_id, course_id, batch_id, caste_category, gender)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [full_name, email, mobile_number, alternate_number, prn_number, eligibility_number, department_id, course_id, batch_id, caste_category, gender]
    );
    return res.rows[0];
};

const createFeeLedger = async (client, data) => {
    const { student_id, academic_year, academic_year_num, total_yearly_fee } = data;
    const res = await client.query(
        `INSERT INTO student_fee_ledger (student_id, academic_year, academic_year_num, total_yearly_fee)
         VALUES ($1, $2, $3, $4)
         RETURNING id, academic_year, academic_year_num, total_yearly_fee, total_paid, pending_fee, status`,
        [student_id, academic_year, academic_year_num, total_yearly_fee]
    );
    return res.rows[0];
};

const listAll = async (query, values, pagination = {}) => {
    const params = [...values];
    let finalQuery = query;

    if (pagination.limit !== undefined && pagination.offset !== undefined) {
        finalQuery += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(pagination.limit, pagination.offset);
    }

    const { rows } = await pool.query(finalQuery, params);
    return rows;
};

const countAll = async (query, values) => {
    const { rows } = await pool.query(query, values);
    return parseInt(rows[0]?.total || 0, 10);
};

const findByIdWithDetails = async (id) => {
    const res = await pool.query(
        `SELECT 
            s.*, 
            d.name as department_name,
            c.course_name,
            cb.batch_name
         FROM students s
         JOIN departments d ON s.department_id = d.id
         JOIN courses c ON s.course_id = c.id
         JOIN course_batches cb ON s.batch_id = cb.id
         WHERE s.id = $1`,
        [id]
    );
    return res.rows[0];
};

const getLedgerByStudent = async (studentId) => {
    const res = await pool.query(
        `SELECT id as ledger_id, academic_year, academic_year_num, total_yearly_fee, total_paid, pending_fee, status
         FROM student_fee_ledger
         WHERE student_id = $1
         ORDER BY academic_year_num ASC`,
        [studentId]
    );
    return res.rows;
};

const getRecentTransactionsByStudent = async (studentId, limit = 20) => {
    const res = await pool.query(
        `SELECT ft.id, ft.amount_paid, ft.payment_mode, ft.payment_reference, ft.receipt_number,
                sfl.academic_year, ft.transaction_date, ft.created_at
         FROM fee_transactions ft
         JOIN student_fee_ledger sfl ON ft.ledger_id = sfl.id
         WHERE ft.student_id = $1
         ORDER BY ft.created_at DESC
         LIMIT $2`,
        [studentId, limit]
    );
    return res.rows;
};

const exists = async (id) => {
    const res = await pool.query("SELECT id FROM students WHERE id = $1", [id]);
    return res.rows.length > 0;
};

const update = async (query, values) => {
    const { rows } = await pool.query(query, values);
    return rows[0];
};

export default {
    getBatchWithDetails,
    getCourseDeptId,
    getEnrolledCount,
    getBatchFeesByYear,
    createStudent,
    createFeeLedger,
    listAll,
    countAll,
    findByIdWithDetails,
    getLedgerByStudent,
    getRecentTransactionsByStudent,
    exists,
    update
};
