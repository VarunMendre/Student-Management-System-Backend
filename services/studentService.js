import { pool } from "../config/db.js";
import { CustomError } from "../utils/customError.js";
import { getAcademicYearLabels } from "../utils/receiptGenerator.js";

/**
 * Enroll a new student.
 * Transactional: Creates student record + N fee ledger rows (one per academic year).
 */
const enrollStudent = async (data) => {
    const {
        full_name, email, mobile_number, alternate_number,
        prn_number, eligibility_number,
        department_id, course_id, batch_id,
        caste_category, gender
    } = data;

    // 1. Validate that batch exists, is active, and belongs to the given course
    const batchRes = await pool.query(
        "SELECT cb.id, cb.course_id, cb.batch_name, cb.total_seats, cb.is_active, c.duration, c.course_name, d.name as department_name FROM course_batches cb JOIN courses c ON cb.course_id = c.id JOIN departments d ON c.department_id = d.id WHERE cb.id = $1",
        [batch_id]
    );

    if (batchRes.rows.length === 0) {
        throw new CustomError("Batch not found", 400);
    }

    const batch = batchRes.rows[0];

    if (!batch.is_active) {
        throw new CustomError("Batch is not active. Cannot enroll students into an inactive batch.", 400);
    }

    if (batch.course_id !== course_id) {
        throw new CustomError("Batch does not belong to the specified course", 400);
    }

    // Validate department matches the course
    const courseCheck = await pool.query(
        "SELECT department_id FROM courses WHERE id = $1",
        [course_id]
    );
    if (courseCheck.rows.length === 0) {
        throw new CustomError("Course not found", 400);
    }
    if (courseCheck.rows[0].department_id !== department_id) {
        throw new CustomError("Course does not belong to the specified department", 400);
    }

    // 2. Check seat availability
    const seatCheck = await pool.query(
        "SELECT COUNT(*) as enrolled FROM students WHERE batch_id = $1 AND enrollment_status = 'Active'",
        [batch_id]
    );
    const enrolledCount = parseInt(seatCheck.rows[0].enrolled);
    if (enrolledCount >= batch.total_seats) {
        throw new CustomError("Batch is full. No available seats.", 409);
    }

    // 3. Get total yearly fee from course_fees
    const feeRes = await pool.query(
        "SELECT COALESCE(SUM(amount), 0) as total_fee FROM course_fees WHERE batch_id = $1",
        [batch_id]
    );
    const yearlyFee = parseFloat(feeRes.rows[0].total_fee);

    if (yearlyFee <= 0) {
        throw new CustomError("No fee components found for this batch. Please configure fees before enrolling students.", 400);
    }

    // 4. Generate academic year labels from course duration
    const yearLabels = getAcademicYearLabels(batch.duration);

    // 5. Begin transaction
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Insert student
        const studentRes = await client.query(
            `INSERT INTO students (full_name, email, mobile_number, alternate_number, prn_number, eligibility_number, department_id, course_id, batch_id, caste_category, gender)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [full_name, email, mobile_number, alternate_number, prn_number, eligibility_number, department_id, course_id, batch_id, caste_category, gender]
        );

        const student = studentRes.rows[0];

        // Insert fee ledger rows — one per academic year
        const ledgerRows = [];
        for (let i = 0; i < yearLabels.length; i++) {
            const ledgerRes = await client.query(
                `INSERT INTO student_fee_ledger (student_id, academic_year, academic_year_num, total_yearly_fee)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, academic_year, academic_year_num, total_yearly_fee, total_paid, pending_fee, status`,
                [student.id, yearLabels[i], i + 1, yearlyFee]
            );
            ledgerRows.push(ledgerRes.rows[0]);
        }

        await client.query("COMMIT");

        // Build response
        return {
            id: student.id,
            full_name: student.full_name,
            email: student.email,
            mobile_number: student.mobile_number,
            alternate_number: student.alternate_number,
            prn_number: student.prn_number,
            eligibility_number: student.eligibility_number,
            department_id: student.department_id,
            department_name: batch.department_name,
            course_id: student.course_id,
            course_name: batch.course_name,
            batch_id: student.batch_id,
            batch_name: batch.batch_name,
            caste_category: student.caste_category,
            gender: student.gender,
            enrollment_status: student.enrollment_status,
            enrolled_at: student.enrolled_at,
            fee_summary: {
                total_course_fee: yearlyFee * yearLabels.length,
                yearly_fee: yearlyFee,
                years: yearLabels.length,
                ledger: ledgerRows.map(row => ({
                    academic_year: row.academic_year,
                    academic_year_num: row.academic_year_num,
                    total_yearly_fee: parseFloat(row.total_yearly_fee),
                    total_paid: parseFloat(row.total_paid),
                    pending_fee: parseFloat(row.pending_fee),
                    status: row.status
                }))
            }
        };

    } catch (error) {
        await client.query("ROLLBACK");

        // Handle unique email constraint violation
        if (error.code === "23505" && error.constraint?.includes("email")) {
            throw new CustomError("A student with this email already exists", 409);
        }
        throw error;
    } finally {
        client.release();
    }
};

/**
 * List all enrolled students with optional filters & search.
 * Includes aggregated fee totals across all years.
 */
const listStudents = async (filters = {}) => {
    const { department_id, course_id, batch_id, status, search } = filters;

    let query = `
        SELECT 
            s.id, s.full_name, s.email, s.mobile_number, s.prn_number,
            d.name as department_name,
            c.course_name,
            cb.batch_name,
            s.caste_category, s.gender, s.enrollment_status,
            COALESCE(SUM(sfl.total_yearly_fee), 0) as total_course_fee,
            COALESCE(SUM(sfl.total_paid), 0) as total_paid,
            COALESCE(SUM(sfl.pending_fee), 0) as total_pending
        FROM students s
        JOIN departments d ON s.department_id = d.id
        JOIN courses c ON s.course_id = c.id
        JOIN course_batches cb ON s.batch_id = cb.id
        LEFT JOIN student_fee_ledger sfl ON s.id = sfl.student_id
    `;

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (department_id) {
        conditions.push(`s.department_id = $${paramIndex++}`);
        values.push(department_id);
    }
    if (course_id) {
        conditions.push(`s.course_id = $${paramIndex++}`);
        values.push(course_id);
    }
    if (batch_id) {
        conditions.push(`s.batch_id = $${paramIndex++}`);
        values.push(batch_id);
    }
    if (status) {
        conditions.push(`s.enrollment_status = $${paramIndex++}`);
        values.push(status);
    }
    if (search) {
        conditions.push(`(s.full_name ILIKE $${paramIndex} OR s.email ILIKE $${paramIndex} OR s.prn_number ILIKE $${paramIndex})`);
        values.push(`%${search}%`);
        paramIndex++;
    }

    if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
    }

    query += `
        GROUP BY s.id, s.full_name, s.email, s.mobile_number, s.prn_number,
                 d.name, c.course_name, cb.batch_name,
                 s.caste_category, s.gender, s.enrollment_status
        ORDER BY s.enrolled_at DESC
    `;

    const { rows } = await pool.query(query, values);

    return rows.map(row => ({
        ...row,
        total_course_fee: parseFloat(row.total_course_fee),
        total_paid: parseFloat(row.total_paid),
        total_pending: parseFloat(row.total_pending)
    }));
};

/**
 * Get single student with full details, fee ledger, and recent transactions.
 */
const getStudentById = async (id) => {
    // Fetch student with joined names
    const studentRes = await pool.query(
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

    if (studentRes.rows.length === 0) {
        throw new CustomError("Student not found", 404);
    }

    const student = studentRes.rows[0];

    // Fetch fee ledger
    const ledgerRes = await pool.query(
        `SELECT id as ledger_id, academic_year, academic_year_num, total_yearly_fee, total_paid, pending_fee, status
         FROM student_fee_ledger
         WHERE student_id = $1
         ORDER BY academic_year_num ASC`,
        [id]
    );

    // Fetch recent transactions (last 20)
    const txnRes = await pool.query(
        `SELECT ft.id, ft.amount_paid, ft.payment_mode, ft.payment_reference, ft.receipt_number,
                sfl.academic_year, ft.transaction_date, ft.created_at
         FROM fee_transactions ft
         JOIN student_fee_ledger sfl ON ft.ledger_id = sfl.id
         WHERE ft.student_id = $1
         ORDER BY ft.created_at DESC
         LIMIT 20`,
        [id]
    );

    return {
        id: student.id,
        full_name: student.full_name,
        email: student.email,
        mobile_number: student.mobile_number,
        alternate_number: student.alternate_number,
        prn_number: student.prn_number,
        eligibility_number: student.eligibility_number,
        department_name: student.department_name,
        course_name: student.course_name,
        batch_name: student.batch_name,
        caste_category: student.caste_category,
        gender: student.gender,
        enrollment_status: student.enrollment_status,
        enrolled_at: student.enrolled_at,
        fee_ledger: ledgerRes.rows.map(row => ({
            ...row,
            total_yearly_fee: parseFloat(row.total_yearly_fee),
            total_paid: parseFloat(row.total_paid),
            pending_fee: parseFloat(row.pending_fee)
        })),
        recent_transactions: txnRes.rows.map(row => ({
            ...row,
            amount_paid: parseFloat(row.amount_paid)
        }))
    };
};

/**
 * Partial update of student info (name, email, phone, prn, eligibility, status).
 */
const updateStudent = async (id, data) => {
    // Verify student exists
    const existing = await pool.query("SELECT id FROM students WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
        throw new CustomError("Student not found", 404);
    }

    // Build dynamic UPDATE query from provided fields
    const allowedFields = [
        "full_name", "email", "mobile_number", "alternate_number",
        "prn_number", "eligibility_number", "enrollment_status"
    ];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            updates.push(`${field} = $${paramIndex++}`);
            values.push(data[field]);
        }
    }

    if (updates.length === 0) {
        throw new CustomError("No valid fields provided for update", 400);
    }

    // Always update the updated_at timestamp
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `UPDATE students SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING id, full_name, email, mobile_number, alternate_number, prn_number, eligibility_number, enrollment_status, updated_at`;

    try {
        const { rows } = await pool.query(query, values);
        return rows[0];
    } catch (error) {
        if (error.code === "23505" && error.constraint?.includes("email")) {
            throw new CustomError("A student with this email already exists", 409);
        }
        throw error;
    }
};

export default { enrollStudent, listStudents, getStudentById, updateStudent };
