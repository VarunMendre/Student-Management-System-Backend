import { pool } from "../config/db.js";
import { getAcademicYearLabels, normalizeAcademicYearLabel } from "../utils/receiptGenerator.js";

const safeParseJsonArray = (value) => {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "object") return [];

    const raw = String(value).trim();
    if (!raw || raw.toLowerCase() === "null" || raw.toLowerCase() === "undefined") return [];

    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const STUDENT_FILTER_COLUMNS = {
    department_id: "s.department_id",
    course_id: "s.course_id",
    batch_id: "s.batch_id",
    status: "s.enrollment_status"
};

const buildStudentFilterParts = (filters = {}) => {
    const conditions = [];
    const values = [];

    Object.entries(STUDENT_FILTER_COLUMNS).forEach(([filterKey, column]) => {
        if (!filters[filterKey]) {
            return;
        }

        conditions.push(`${column} = ?`);
        values.push(filters[filterKey]);
    });

    if (filters.search) {
        conditions.push(`(s.full_name LIKE ? OR s.email LIKE ? OR s.prn_number LIKE ?)`);
        const searchVal = `%${filters.search}%`;
        values.push(searchVal, searchVal, searchVal);
    }

    return {
        whereClause: conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "",
        values
    };
};

const getBatchWithDetails = async (batchId) => {
    const [rows] = await pool.query(
        `SELECT cb.id, cb.course_id, cb.batch_name, cb.total_seats, cb.is_active, 
                c.duration, c.course_name, d.name as department_name 
         FROM course_batches cb 
         JOIN courses c ON cb.course_id = c.id 
         JOIN departments d ON c.department_id = d.id 
         WHERE cb.id = ?`,
        [batchId]
    );
    return rows[0];
};

const getCourseDeptId = async (courseId) => {
    const [rows] = await pool.query("SELECT department_id FROM courses WHERE id = ?", [courseId]);
    return rows[0];
};

const getEnrolledCount = async (batchId) => {
    const [rows] = await pool.query(
        "SELECT COUNT(*) as enrolled FROM students WHERE batch_id = ? AND enrollment_status = 'Active'",
        [batchId]
    );
    return parseInt(rows[0].enrolled);
};

const getBatchFeesByYear = async (batchId) => {
    const [rows] = await pool.query(
        `SELECT cf.component_name, cf.amount, c.duration
         FROM course_fees cf
         JOIN course_batches cb ON cf.batch_id = cb.id
         JOIN courses c ON cb.course_id = c.id
         WHERE cf.batch_id = ?`,
        [batchId]
    );
    const fees = {};
    rows.forEach(r => {
        const year = normalizeAcademicYearLabel(r.component_name.split(' - ')[0], r.duration);
        fees[year] = (fees[year] || 0) + parseFloat(r.amount);
    });
    return fees;
};

const createStudent = async (connection, data) => {
    const { 
        full_name, email, mobile_number, alternate_number, 
        prn_number, eligibility_number, department_id, 
        course_id, batch_id, caste_category, gender 
    } = data;
    
    const [result] = await connection.query(
        `INSERT INTO students (full_name, email, mobile_number, alternate_number, prn_number, eligibility_number, department_id, course_id, batch_id, caste_category, gender)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [full_name, email, mobile_number, alternate_number, prn_number, eligibility_number, department_id, course_id, batch_id, caste_category, gender]
    );
    
    const [rows] = await connection.query("SELECT * FROM students WHERE id = ?", [result.insertId]);
    return rows[0];
};

const createFeeLedger = async (connection, data) => {
    const { student_id, academic_year, academic_year_num, total_yearly_fee, total_paid = 0, status = "Pending" } = data;
    const [result] = await connection.query(
        `INSERT INTO student_fee_ledger (student_id, academic_year, academic_year_num, total_yearly_fee, total_paid, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [student_id, academic_year, academic_year_num, total_yearly_fee, total_paid, status]
    );
    
    const [rows] = await connection.query(
        `SELECT id, academic_year, academic_year_num, total_yearly_fee, total_paid, pending_fee, status 
         FROM student_fee_ledger WHERE id = ?`,
        [result.insertId]
    );
    return rows[0];
};

const listAll = async (query, values, pagination = {}) => {
    const params = [...values];
    let finalQuery = query;

    if (pagination.limit !== undefined && pagination.offset !== undefined) {
        finalQuery += ` LIMIT ? OFFSET ?`;
        params.push(Number(pagination.limit), Number(pagination.offset));
    }

    const [rows] = await pool.query(finalQuery, params);
    
    // Parse JSON strings from MariaDB
    return rows.map(row => ({
        ...row,
        fee_ledger: safeParseJsonArray(row.fee_ledger)
    }));
};

const countAll = async (query, values) => {
    const [rows] = await pool.query(query, values);
    return parseInt(rows[0]?.total || 0, 10);
};

const findByIdWithDetails = async (id) => {
    const [rows] = await pool.query(
        `SELECT 
            s.*, 
            d.name as department_name,
            c.course_name,
            cb.batch_name,
            (SELECT SUM(total_yearly_fee) FROM student_fee_ledger WHERE student_id = s.id) as total_course_fee,
            (SELECT SUM(total_paid) FROM student_fee_ledger WHERE student_id = s.id) as total_paid,
            (SELECT SUM(pending_fee) FROM student_fee_ledger WHERE student_id = s.id) as total_pending,
            (SELECT SUM(amount_paid) FROM fee_transactions WHERE student_id = s.id AND payment_mode = 'Scholarship' AND status = 'Active') as scholarship_paid,
            (SELECT SUM(amount_paid) FROM fee_transactions WHERE student_id = s.id AND payment_mode <> 'Scholarship' AND status = 'Active') as regular_paid,
            (
                SELECT JSON_QUERY(CONCAT('[', GROUP_CONCAT(
                    JSON_OBJECT(
                        'academic_year', academic_year,
                        'academic_year_num', academic_year_num,
                        'total_yearly_fee', total_yearly_fee,
                        'total_paid', total_paid,
                        'pending_fee', pending_fee,
                        'status', status
                    )
                    ORDER BY academic_year_num ASC
                ), ']'), '$')
                FROM student_fee_ledger
                WHERE student_id = s.id
            ) as fee_ledger,
            (
                SELECT sfl2.academic_year
                FROM student_fee_ledger sfl2
                WHERE sfl2.student_id = s.id
                ORDER BY 
                    CASE WHEN sfl2.status <> 'Paid' THEN 0 ELSE 1 END, 
                    sfl2.academic_year_num ASC
                LIMIT 1
            ) as current_academic_year
         FROM students s
         JOIN departments d ON s.department_id = d.id
         JOIN courses c ON s.course_id = c.id
         JOIN course_batches cb ON s.batch_id = cb.id
         WHERE s.id = ?`,
        [id]
    );
    const student = rows[0];
    if (student) {
        student.fee_ledger = safeParseJsonArray(student.fee_ledger);
    }
    return student;
};

const getLedgerByStudent = async (studentId) => {
    const [rows] = await pool.query(
        `SELECT id as ledger_id, academic_year, academic_year_num, total_yearly_fee, total_paid, pending_fee, status
         FROM student_fee_ledger
         WHERE student_id = ?
         ORDER BY academic_year_num ASC`,
        [studentId]
    );
    return rows;
};

const syncLedgerFeesFromBatch = async (studentId) => {
    const [rows] = await pool.query(
        `SELECT
            s.id AS student_id,
            s.batch_id,
            c.duration,
            sfl.id AS ledger_id,
            sfl.academic_year,
            sfl.academic_year_num,
            sfl.total_yearly_fee,
            sfl.total_paid,
            sfl.pending_fee
         FROM students s
         JOIN course_batches cb ON cb.id = s.batch_id
         JOIN courses c ON c.id = cb.course_id
         JOIN student_fee_ledger sfl ON sfl.student_id = s.id
         WHERE s.id = ?`,
        [studentId]
    );

    if (!rows.length) {
        return;
    }

    const batchId = rows[0].batch_id;
    const duration = rows[0].duration;
    const batchFees = await getBatchFeesByYear(batchId);
    const canonicalYearLabels = getAcademicYearLabels(duration);
    const existingByYearNum = new Map(rows.map((row) => [Number(row.academic_year_num), row]));

    const updates = rows
        .map((row) => {
            const yearIndex = Number(row.academic_year_num) - 1;
            const canonicalAcademicYear = canonicalYearLabels[yearIndex] || normalizeAcademicYearLabel(row.academic_year, duration);
            const targetFee = Number(batchFees[canonicalAcademicYear] || batchFees[row.academic_year] || 0);
            const currentFee = Number(row.total_yearly_fee || 0);
            const totalPaid = Number(row.total_paid || 0);
            const currentPending = Number(row.pending_fee || 0);

            if (targetFee <= 0 && row.academic_year === canonicalAcademicYear) {
                return null;
            }

            if (currentFee > 0 && totalPaid > 0 && row.academic_year === canonicalAcademicYear && currentFee === targetFee) {
                return null;
            }

            const nextPending = Math.max(0, targetFee - totalPaid);
            if (row.academic_year === canonicalAcademicYear && currentFee === targetFee && currentPending === nextPending) {
                return null;
            }

            return {
                ledgerId: row.ledger_id,
                academicYear: canonicalAcademicYear,
                academicYearNum: Number(row.academic_year_num),
                totalYearlyFee: targetFee,
                pendingFee: nextPending
            };
        })
        .filter(Boolean);

    const inserts = canonicalYearLabels
        .map((academicYear, index) => {
            const academicYearNum = index + 1;
            if (existingByYearNum.has(academicYearNum)) {
                return null;
            }

            const totalYearlyFee = Number(batchFees[academicYear] || 0);
            return {
                academicYear,
                academicYearNum,
                totalYearlyFee,
                pendingFee: totalYearlyFee
            };
        })
        .filter(Boolean);

    if (!updates.length && !inserts.length) {
        return;
    }

    await Promise.all(
        updates.map((update) =>
            pool.query(
                `UPDATE student_fee_ledger
                 SET academic_year = ?, total_yearly_fee = ?, pending_fee = ?
                 WHERE id = ?`,
                [update.academicYear, update.totalYearlyFee, update.pendingFee, update.ledgerId]
            )
        )
    );

    if (inserts.length) {
        await Promise.all(
            inserts.map((entry) =>
                pool.query(
                    `INSERT INTO student_fee_ledger (student_id, academic_year, academic_year_num, total_yearly_fee, total_paid, pending_fee, status)
                     VALUES (?, ?, ?, ?, 0, ?, ?)`,
                    [
                        studentId,
                        entry.academicYear,
                        entry.academicYearNum,
                        entry.totalYearlyFee,
                        entry.pendingFee,
                        entry.totalYearlyFee > 0 ? "Pending" : "Paid"
                    ]
                )
            )
        );
    }
};

const getRecentTransactionsByStudent = async (studentId, limit = 20) => {
    const [rows] = await pool.query(
        `SELECT ft.id, ft.amount_paid, ft.payment_mode, ft.payment_reference, ft.receipt_number,
                sfl.academic_year, ft.transaction_date, ft.created_at
         FROM fee_transactions ft
         JOIN student_fee_ledger sfl ON ft.ledger_id = sfl.id
         WHERE ft.student_id = ?
           AND ft.status = 'Active'
         ORDER BY ft.created_at DESC
         LIMIT ?`,
        [studentId, Number(limit)]
    );
    return rows;
};

const exists = async (id) => {
    const [rows] = await pool.query("SELECT id FROM students WHERE id = ?", [id]);
    return rows.length > 0;
};

const update = async (query, values) => {
    const [result] = await pool.query(query, values);
    return result;
};

const syncStudentProfile = async (studentId, { full_name, email, mobile_number }) => {
    await pool.query(
        `UPDATE students 
         SET full_name = ?, email = ?, mobile_number = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [full_name, email, mobile_number, studentId]
    );
    
    const [rows] = await pool.query(
        `SELECT id, full_name, email, mobile_number FROM students WHERE id = ?`,
        [studentId]
    );
    return rows[0] || null;
};

const getFeeLedgerReport = async (filters = {}) => {
    const baseQuery = `
        SELECT 
            s.id, s.full_name, s.email, s.prn_number,
            d.name as department_name, c.course_name, c.duration, cb.batch_name,
            (SELECT SUM(total_yearly_fee) FROM student_fee_ledger WHERE student_id = s.id) as total_course_fee,
            (SELECT SUM(total_paid) FROM student_fee_ledger WHERE student_id = s.id) as total_paid,
            (SELECT SUM(pending_fee) FROM student_fee_ledger WHERE student_id = s.id) as total_pending,
            (
                SELECT JSON_QUERY(CONCAT('[', GROUP_CONCAT(
                    JSON_OBJECT(
                        'academic_year', academic_year,
                        'academic_year_num', academic_year_num,
                        'pending_fee', pending_fee,
                        'total_paid', total_paid,
                        'total_yearly_fee', total_yearly_fee
                    )
                    ORDER BY academic_year_num ASC
                ), ']'), '$')
                FROM student_fee_ledger
                WHERE student_id = s.id
            ) as fee_ledger
        FROM students s
        JOIN departments d ON s.department_id = d.id
        JOIN courses c ON s.course_id = c.id
        JOIN course_batches cb ON s.batch_id = cb.id
    `;

    const { whereClause, values } = buildStudentFilterParts(filters);
    const query = `${baseQuery}${whereClause} ORDER BY s.full_name ASC`;
    
    const [rows] = await pool.query(query, values);
    return rows.map(row => ({
        ...row,
        fee_ledger: safeParseJsonArray(row.fee_ledger)
    }));
};

const findStudents = async (filters = {}, pagination = {}) => {
    const baseQuery = `
        SELECT 
            s.id, s.full_name, s.email, s.mobile_number, s.prn_number,
            s.department_id, s.course_id, s.batch_id,
            d.name as department_name, c.course_name, cb.batch_name,
            s.caste_category, s.gender, s.enrollment_status,
            (SELECT SUM(total_yearly_fee) FROM student_fee_ledger WHERE student_id = s.id) as total_course_fee,
            (SELECT SUM(total_paid) FROM student_fee_ledger WHERE student_id = s.id) as total_paid,
            (SELECT SUM(pending_fee) FROM student_fee_ledger WHERE student_id = s.id) as total_pending,
            (
                SELECT JSON_QUERY(CONCAT('[', GROUP_CONCAT(
                    JSON_OBJECT(
                        'academic_year', academic_year,
                        'academic_year_num', academic_year_num,
                        'total_yearly_fee', total_yearly_fee,
                        'total_paid', total_paid,
                        'pending_fee', pending_fee,
                        'status', status
                    )
                    ORDER BY academic_year_num ASC
                ), ']'), '$')
                FROM student_fee_ledger
                WHERE student_id = s.id
            ) as fee_ledger,
            (
                SELECT sfl2.academic_year
                FROM student_fee_ledger sfl2
                WHERE sfl2.student_id = s.id
                ORDER BY 
                    CASE WHEN sfl2.status <> 'Paid' THEN 0 ELSE 1 END, 
                    sfl2.academic_year_num ASC
                LIMIT 1
            ) as current_academic_year,
            (SELECT COUNT(id) FROM fee_transactions WHERE student_id = s.id AND status = 'Active') as transaction_count
        FROM students s
        JOIN departments d ON s.department_id = d.id
        JOIN courses c ON s.course_id = c.id
        JOIN course_batches cb ON s.batch_id = cb.id
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

    const [rows] = await pool.query(`${baseQuery}${whereClause}`, values);
    return parseInt(rows[0]?.total || 0, 10);
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

    allowedFields.forEach((field) => {
        if (data[field] === undefined) {
            return;
        }

        updates.push(`${field} = ?`);
        values.push(data[field]);
    });

    if (!updates.length) {
        return null;
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    await pool.query(
        `UPDATE students
         SET ${updates.join(", ")}
         WHERE id = ?`,
        values
    );
    
    const [rows] = await pool.query(
        `SELECT id, full_name, email, mobile_number, alternate_number, prn_number, eligibility_number, department_id, course_id, batch_id, caste_category, gender, enrollment_status, updated_at FROM students WHERE id = ?`,
        [id]
    );
    return rows[0];
};

const findExistingEmails = async (emails = []) => {
    if (!emails.length) return [];
    const placeholders = emails.map(() => "?").join(",");
    const [rows] = await pool.query(
        `SELECT email FROM students WHERE email IN (${placeholders})`,
        emails
    );
    return rows.map(r => r.email);
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
    syncLedgerFeesFromBatch,
    getRecentTransactionsByStudent,
    exists,
    update,
    syncStudentProfile,
    getFeeLedgerReport,
    findStudents,
    countStudents,
    updateStudentById,
    findExistingEmails
};
