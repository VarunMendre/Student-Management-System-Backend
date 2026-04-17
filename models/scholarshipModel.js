import { pool } from "../config/db.js";
import { getCategoryCandidates } from "../utils/scholarshipParser.js";

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
    // Normalize inputs to prevent duplicates due to casing/spacing
    const normalizedCaste = String(caste || "").trim();
    const normalizedGender = String(gender || "").trim();
    
    await client.query(`
        INSERT INTO course_scholarship_config (course_id, caste_category, gender, max_amount)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (course_id, caste_category, gender) 
        DO UPDATE SET max_amount = EXCLUDED.max_amount, is_active = TRUE
    `, [courseId, normalizedCaste, normalizedGender, amount]);
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
    const categoryCandidates = getCategoryCandidates(category);
    const loweredCandidates = categoryCandidates.map((item) => item.toLowerCase());
    const res = await client.query(`
        SELECT max_amount FROM course_scholarship_config
        WHERE course_id = $1
          AND gender = $2
          AND is_active = TRUE
          AND LOWER(caste_category) = ANY($3::text[])
        ORDER BY
          CASE
            WHEN LOWER(caste_category) = LOWER($4) THEN 0
            ELSE 1
          END
        LIMIT 1
    `, [courseId, gender, loweredCandidates, category]);
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

const getStudentIdByUserId = async (userId) => {
    const res = await pool.query(
        "SELECT student_id FROM app_users WHERE id = $1 AND role = 'student'",
        [userId]
    );
    return res.rows[0]?.student_id || null;
};

const getStudentForScholarship = async (studentId) => {
    const res = await pool.query(`
        SELECT s.id, s.full_name, s.course_id, s.caste_category, s.gender,
               c.course_name
        FROM students s
        JOIN courses c ON c.id = s.course_id
        WHERE s.id = $1
    `, [studentId]);
    return res.rows[0] || null;
};

const getScholarshipConfigForStudent = async (courseId, category, gender) => {
    const categoryCandidates = getCategoryCandidates(category);
    const loweredCandidates = categoryCandidates.map((item) => item.toLowerCase());
    const res = await pool.query(`
        SELECT max_amount
        FROM course_scholarship_config
        WHERE course_id = $1
          AND gender = $2
          AND is_active = TRUE
          AND LOWER(caste_category) = ANY($3::text[])
        ORDER BY
          CASE
            WHEN LOWER(caste_category) = LOWER($4) THEN 0
            ELSE 1
          END
        LIMIT 1
    `, [courseId, gender, loweredCandidates, category]);
    return res.rows[0] || null;
};

const findApplicationByStudentAndCycle = async (studentId, _academicCycle = null) => {
    const res = await pool.query(`
        SELECT *
        FROM scholarship_applications
        WHERE student_id = $1
        LIMIT 1
    `, [studentId]);
    return res.rows[0] || null;
};

const findApplicationByIdAndCycle = async (applicationId, _academicCycle = null) => {
    const res = await pool.query(`
        SELECT *
        FROM scholarship_applications
        WHERE application_id = $1
        LIMIT 1
    `, [applicationId]);
    return res.rows[0] || null;
};

const upsertScholarshipApplication = async (client, data) => {
    const {
        studentId,
        academicCycle,
        applicationId,
        extractedApplicationId,
        formPath,
        formOriginalName
    } = data;

    const res = await client.query(`
        INSERT INTO scholarship_applications (
            student_id, academic_cycle, application_id, application_id_extracted,
            form_path, form_original_name, match_status, submission_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'matched', 'pending_verification')
        ON CONFLICT (student_id)
        DO UPDATE SET
            application_id = EXCLUDED.application_id,
            application_id_extracted = EXCLUDED.application_id_extracted,
            form_path = EXCLUDED.form_path,
            form_original_name = EXCLUDED.form_original_name,
            match_status = 'matched',
            submission_status = 'pending_verification',
            submitted_at = CURRENT_TIMESTAMP,
            approved_at = NULL,
            approved_by = NULL,
            rejected_at = NULL,
            rejected_by = NULL,
            rejection_reason = NULL
        RETURNING *
    `, [studentId, academicCycle, applicationId, extractedApplicationId, formPath, formOriginalName]);
    return res.rows[0];
};

const createScholarshipAuditLog = async (client, data) => {
    const {
        applicationRecordId = null,
        actorUserId = null,
        actorRole,
        action,
        details = {}
    } = data;

    await client.query(`
        INSERT INTO scholarship_audit_logs (
            application_id, actor_user_id, actor_role, action, details
        )
        VALUES ($1, $2, $3, $4, $5::jsonb)
    `, [applicationRecordId, actorUserId, actorRole, action, JSON.stringify(details || {})]);
};

const getStudentApplicationByStudentAndCycle = async (studentId, _academicCycle = null) => {
    const res = await pool.query(`
        SELECT sa.id, sa.student_id, sa.academic_cycle, sa.application_id, sa.application_id_extracted,
               sa.form_path, sa.form_original_name, sa.match_status, sa.submission_status,
               sa.submitted_at, sa.approved_at, sa.rejected_at, sa.rejection_reason
        FROM scholarship_applications sa
        WHERE sa.student_id = $1
        LIMIT 1
    `, [studentId]);
    return res.rows[0] || null;
};

const listApplicationsForAdmin = async () => {
    const res = await pool.query(`
        SELECT sa.id, sa.student_id, sa.academic_cycle, sa.application_id, sa.application_id_extracted,
               sa.form_path, sa.form_original_name, sa.match_status, sa.submission_status,
               sa.submitted_at, sa.approved_at, sa.rejected_at, sa.rejection_reason,
               s.full_name, s.course_id, c.course_name
        FROM scholarship_applications sa
        JOIN students s ON s.id = sa.student_id
        JOIN courses c ON c.id = s.course_id
        ORDER BY sa.submitted_at DESC
    `);
    return res.rows;
};

const getPendingApplicationsByCycle = async (_academicCycle = null) => {
    const res = await pool.query(`
        SELECT sa.*, s.full_name
        FROM scholarship_applications sa
        JOIN students s ON s.id = sa.student_id
        WHERE sa.submission_status = 'pending_verification'
    `);
    return res.rows;
};

const getApplicationsByIdsAndCycle = async (applicationIds, _academicCycle = null) => {
    if (!applicationIds.length) return [];
    const res = await pool.query(`
        SELECT sa.*, s.full_name
        FROM scholarship_applications sa
        JOIN students s ON s.id = sa.student_id
        WHERE sa.application_id = ANY($1::text[])
    `, [applicationIds]);
    return res.rows;
};

const markApplicationApproved = async (client, applicationRecordId, approverUserId) => {
    const res = await client.query(`
        UPDATE scholarship_applications
        SET submission_status = 'approved',
            approved_at = CURRENT_TIMESTAMP,
            approved_by = $2
        WHERE id = $1
        RETURNING *
    `, [applicationRecordId, approverUserId]);
    return res.rows[0] || null;
};

const markApplicationConflict = async (client, applicationRecordId, actorUserId, reason = "Duplicate application ID in uploaded gov sheet") => {
    const res = await client.query(`
        UPDATE scholarship_applications
        SET submission_status = 'conflict',
            rejected_at = CURRENT_TIMESTAMP,
            rejected_by = $2,
            rejection_reason = $3
        WHERE id = $1
        RETURNING *
    `, [applicationRecordId, actorUserId, reason]);
    return res.rows[0] || null;
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
    markAsReversed,
    getStudentIdByUserId,
    getStudentForScholarship,
    getScholarshipConfigForStudent,
    findApplicationByStudentAndCycle,
    findApplicationByIdAndCycle,
    upsertScholarshipApplication,
    createScholarshipAuditLog,
    getStudentApplicationByStudentAndCycle,
    listApplicationsForAdmin,
    getPendingApplicationsByCycle,
    getApplicationsByIdsAndCycle,
    markApplicationApproved,
    markApplicationConflict
};
