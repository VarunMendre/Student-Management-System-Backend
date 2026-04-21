import { pool } from "../config/db.js";

const STUDENT_FILTER_COLUMNS = {
    department_id: "s.department_id",
    course_id: "s.course_id",
    batch_id: "s.batch_id",
    status: "s.enrollment_status"
};

const buildStudentFilterParts = (filters = {}) => {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(STUDENT_FILTER_COLUMNS).forEach(([filterKey, column]) => {
        if (!filters[filterKey]) {
            return;
        }

        conditions.push(`${column} = $${paramIndex++}`);
        values.push(filters[filterKey]);
    });

    if (filters.search) {
        conditions.push(`(s.full_name ILIKE $${paramIndex} OR s.email ILIKE $${paramIndex} OR s.prn_number ILIKE $${paramIndex})`);
        values.push(`%${filters.search}%`);
    }

    return {
        whereClause: conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "",
        values
    };
};

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
            cb.batch_name,
            COALESCE(ledger.total_course_fee, 0) as total_course_fee,
            COALESCE(ledger.total_paid, 0) as total_paid,
            COALESCE(ledger.total_pending, 0) as total_pending,
            COALESCE(tx.scholarship_paid, 0) as scholarship_paid,
            COALESCE(tx.regular_paid, 0) as regular_paid,
            ledger.current_academic_year
         FROM students s
         JOIN departments d ON s.department_id = d.id
         JOIN courses c ON s.course_id = c.id
         JOIN course_batches cb ON s.batch_id = cb.id
         LEFT JOIN LATERAL (
            SELECT
                SUM(sfl.total_yearly_fee) as total_course_fee,
                SUM(sfl.total_paid) as total_paid,
                SUM(sfl.pending_fee) as total_pending,
                COALESCE(
                    (
                        SELECT sfl2.academic_year
                        FROM student_fee_ledger sfl2
                        WHERE sfl2.student_id = s.id AND sfl2.pending_fee > 0
                        ORDER BY sfl2.academic_year_num ASC
                        LIMIT 1
                    ),
                    (
                        SELECT sfl3.academic_year
                        FROM student_fee_ledger sfl3
                        WHERE sfl3.student_id = s.id
                        ORDER BY sfl3.academic_year_num DESC
                        LIMIT 1
                    )
                ) as current_academic_year
            FROM student_fee_ledger sfl
            WHERE sfl.student_id = s.id
         ) ledger ON TRUE
         LEFT JOIN LATERAL (
            SELECT
                SUM(CASE WHEN ft.payment_mode = 'Scholarship' THEN ft.amount_paid ELSE 0 END) as scholarship_paid,
                SUM(CASE WHEN ft.payment_mode <> 'Scholarship' THEN ft.amount_paid ELSE 0 END) as regular_paid
            FROM fee_transactions ft
            WHERE ft.student_id = s.id
              AND ft.status = 'Active'
         ) tx ON TRUE
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
           AND ft.status = 'Active'
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

const findStudents = async (filters = {}, pagination = {}) => {
    const baseQuery = `
        SELECT 
            s.id, s.full_name, s.email, s.mobile_number, s.prn_number,
            s.department_id, s.course_id, s.batch_id,
            d.name as department_name, c.course_name, cb.batch_name,
            s.caste_category, s.gender, s.enrollment_status,
            COALESCE(ledger.total_course_fee, 0) as total_course_fee,
            COALESCE(ledger.total_paid, 0) as total_paid,
            COALESCE(ledger.total_pending, 0) as total_pending,
            COALESCE(ledger.fee_ledger, '[]'::jsonb) as fee_ledger,
            ledger.current_academic_year,
            COALESCE(tx.transaction_count, 0) as transaction_count
        FROM students s
        JOIN departments d ON s.department_id = d.id
        JOIN courses c ON s.course_id = c.id
        JOIN course_batches cb ON s.batch_id = cb.id
        LEFT JOIN LATERAL (
            SELECT
                SUM(sfl.total_yearly_fee) as total_course_fee,
                SUM(sfl.total_paid) as total_paid,
                SUM(sfl.pending_fee) as total_pending,
                jsonb_agg(
                    jsonb_build_object(
                        'academic_year', sfl.academic_year,
                        'academic_year_num', sfl.academic_year_num,
                        'total_yearly_fee', sfl.total_yearly_fee,
                        'total_paid', sfl.total_paid,
                        'pending_fee', sfl.pending_fee,
                        'status', sfl.status
                    )
                    ORDER BY sfl.academic_year_num ASC
                ) as fee_ledger,
                COALESCE(
                    (
                        SELECT sfl2.academic_year
                        FROM student_fee_ledger sfl2
                        WHERE sfl2.student_id = s.id AND sfl2.pending_fee > 0
                        ORDER BY sfl2.academic_year_num ASC
                        LIMIT 1
                    ),
                    (
                        SELECT sfl3.academic_year
                        FROM student_fee_ledger sfl3
                        WHERE sfl3.student_id = s.id
                        ORDER BY sfl3.academic_year_num DESC
                        LIMIT 1
                    )
                ) as current_academic_year
            FROM student_fee_ledger sfl
            WHERE sfl.student_id = s.id
        ) ledger ON TRUE
        LEFT JOIN (
            SELECT student_id, COUNT(id) as transaction_count 
            FROM fee_transactions 
            WHERE status = 'Active'
            GROUP BY student_id
        ) tx ON s.id = tx.student_id
    `;
    const { whereClause, values } = buildStudentFilterParts(filters);

    return listAll(`${baseQuery}${whereClause} ORDER BY s.enrolled_at DESC`, values, pagination);
};

const countStudents = async (filters = {}) => {
    const baseQuery = `
        SELECT COUNT(*) as total
        FROM students s
        JOIN departments d ON s.department_id = d.id
        JOIN courses c ON s.course_id = c.id
        JOIN course_batches cb ON s.batch_id = cb.id
    `;
    const { whereClause, values } = buildStudentFilterParts(filters);

    return countAll(`${baseQuery}${whereClause}`, values);
};

const updateStudentById = async (id, data) => {
    const allowedFields = [
        "full_name",
        "email",
        "mobile_number",
        "alternate_number",
        "prn_number",
        "eligibility_number",
        "department_id",
        "course_id",
        "batch_id",
        "caste_category",
        "gender",
        "enrollment_status"
    ];
    const updates = [];
    const values = [];
    let paramIndex = 1;

    allowedFields.forEach((field) => {
        if (data[field] === undefined) {
            return;
        }

        updates.push(`${field} = $${paramIndex++}`);
        values.push(data[field]);
    });

    if (!updates.length) {
        return null;
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    return update(
        `UPDATE students
         SET ${updates.join(", ")}
         WHERE id = $${paramIndex}
         RETURNING id, full_name, email, mobile_number, alternate_number, prn_number, eligibility_number, department_id, course_id, batch_id, caste_category, gender, enrollment_status, updated_at`,
        values
    );
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
    update,
    findStudents,
    countStudents,
    updateStudentById
};
