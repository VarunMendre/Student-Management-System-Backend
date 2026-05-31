import { pool } from "../config/db.js";
import { getCategoryCandidates } from "../utils/scholarshipParser.js";

/**
 * Scholarship Data Access Layer (MySQL Refactored)
 */

const getConfigByCourse = async (courseId) => {
    const [rows] = await pool.query(
        "SELECT * FROM course_scholarship_config WHERE course_id = ? AND is_active = TRUE",
        [courseId]
    );
    return rows;
};

const upsertConfig = async (connection, courseId, caste, gender, amount) => {
    let normalizedCaste = String(caste || "").trim();
    const normalizedGender = String(gender || "").trim();
    
    // Standardize all Open/General variants to 'General'
    const up = normalizedCaste.toUpperCase();
    if (up.includes('OPEN') || up.includes('GENERAL') || up.includes('EBC')) {
        normalizedCaste = 'General';
    }
    
    await connection.query(`
        INSERT INTO course_scholarship_config (course_id, caste_category, gender, max_amount)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE max_amount = VALUES(max_amount), is_active = TRUE
    `, [courseId, normalizedCaste, normalizedGender, amount]);
};

const getStudentAndLedgerForUpdate = async (connection, studentId, yearNum) => {
    const [rows] = await connection.query(`
        SELECT s.id, s.course_id, s.caste_category, s.gender, s.full_name,
               sfl.id as ledger_id, sfl.pending_fee, sfl.total_paid, sfl.total_yearly_fee
        FROM students s
        JOIN student_fee_ledger sfl ON s.id = sfl.student_id
        WHERE s.id = ? AND sfl.academic_year_num = ?
        FOR UPDATE
    `, [studentId, yearNum]);
    return rows[0];
};

const checkDuplicateDisbursal = async (connection, studentId, appId, instNo) => {
    const [rows] = await connection.query(`
        SELECT id FROM fee_transactions 
        WHERE student_id = ? AND application_id = ? AND installment_no = ? 
        AND payment_mode = 'Scholarship' AND status = 'Active'
    `, [studentId, appId, instNo]);
    return rows.length > 0;
};

const getScholarshipConfig = async (connection, courseId, category, gender) => {
    const categoryCandidates = getCategoryCandidates(category);
    const loweredCandidates = categoryCandidates.map((item) => item.toLowerCase());
    
    const placeholders = loweredCandidates.map(() => "?").join(",");
    
    const [rows] = await connection.query(`
        SELECT max_amount FROM course_scholarship_config
        WHERE course_id = ?
          AND gender = ?
          AND is_active = TRUE
          AND LOWER(caste_category) IN (${placeholders})
        ORDER BY
          CASE
            WHEN LOWER(caste_category) = LOWER(?) THEN 0
            ELSE 1
          END
        LIMIT 1
    `, [courseId, gender, ...loweredCandidates, category]);
    return rows[0];
};

const getTotalReceived = async (connection, ledgerId) => {
    const [rows] = await connection.query(`
        SELECT COALESCE(SUM(amount_paid), 0) as total 
        FROM fee_transactions 
        WHERE ledger_id = ? AND payment_mode = 'Scholarship' AND status = 'Active'
    `, [ledgerId]);
    return parseFloat(rows[0].total);
};

const createTransaction = async (connection, data) => {
    const { student_id, ledger_id, amount, mode, reference, receiptNumber, remarks, appId, instNo } = data;
    const [result] = await connection.query(`
        INSERT INTO fee_transactions (
            student_id, ledger_id, amount_paid, payment_mode, 
            payment_reference, receipt_number, remarks, 
            application_id, installment_no, transaction_date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)
    `, [student_id, ledger_id, amount, mode, reference, receiptNumber, remarks, appId, instNo]);
    
    const [rows] = await connection.query("SELECT id, receipt_number FROM fee_transactions WHERE id = ?", [result.insertId]);
    return rows[0];
};

const updateLedgerStatus = async (connection, ledgerId, paid, status) => {
    await connection.query(`
        UPDATE student_fee_ledger
        SET total_paid = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [paid, status, ledgerId]);
};

const getSummary = async () => {
    const [rows] = await pool.query(`
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

const getTransactionWithLedger = async (connection, txnId) => {
    const [rows] = await connection.query(`
        SELECT ft.*, sfl.total_paid, sfl.total_yearly_fee
        FROM fee_transactions ft
        JOIN student_fee_ledger sfl ON ft.ledger_id = sfl.id
        WHERE ft.id = ? AND ft.payment_mode = 'Scholarship' FOR UPDATE
    `, [txnId]);
    return rows[0];
};

const markAsReversed = async (connection, txnId) => {
    await connection.query("UPDATE fee_transactions SET status = 'Reversed' WHERE id = ?", [txnId]);
};

const getStudentIdByUserId = async (userId) => {
    const [rows] = await pool.query(
        "SELECT student_id FROM app_users WHERE id = ? AND role = 'student'",
        [userId]
    );
    return rows[0]?.student_id || null;
};

const getStudentForScholarship = async (studentId) => {
    const [rows] = await pool.query(`
        SELECT s.id, s.full_name, s.course_id, s.caste_category, s.gender,
               c.course_name
        FROM students s
        JOIN courses c ON c.id = s.course_id
        WHERE s.id = ?
    `, [studentId]);
    return rows[0] || null;
};

const getStudentOutstandingSummary = async (studentId) => {
    const [rows] = await pool.query(`
        SELECT
            s.id as student_id,
            COALESCE(SUM(sfl.total_yearly_fee), 0) as total_course_fee,
            COALESCE(SUM(sfl.total_paid), 0) as total_paid,
            COALESCE(SUM(sfl.pending_fee), 0) as total_pending
        FROM students s
        LEFT JOIN student_fee_ledger sfl ON s.id = sfl.student_id
        WHERE s.id = ?
        GROUP BY s.id
    `, [studentId]);
    return rows[0] || null;
};

const getOutstandingSummariesByStudentIds = async (studentIds = []) => {
    if (!studentIds.length) return [];
    
    const placeholders = studentIds.map(() => "?").join(",");
    const [rows] = await pool.query(`
        SELECT
            s.id as student_id,
            COALESCE(SUM(sfl.total_yearly_fee), 0) as total_course_fee,
            COALESCE(SUM(sfl.total_paid), 0) as total_paid,
            COALESCE(SUM(sfl.pending_fee), 0) as total_pending
        FROM students s
        LEFT JOIN student_fee_ledger sfl ON s.id = sfl.student_id
        WHERE s.id IN (${placeholders})
        GROUP BY s.id
    `, studentIds);

    return rows;
};

const getScholarshipConfigForStudent = async (courseId, category, gender) => {
    const categoryCandidates = getCategoryCandidates(category);
    const loweredCandidates = categoryCandidates.map((item) => item.toLowerCase());
    const placeholders = loweredCandidates.map(() => "?").join(",");
    
    const [rows] = await pool.query(`
        SELECT max_amount
        FROM course_scholarship_config
        WHERE course_id = ?
          AND gender = ?
          AND is_active = TRUE
          AND LOWER(caste_category) IN (${placeholders})
        ORDER BY
          CASE
            WHEN LOWER(caste_category) = LOWER(?) THEN 0
            ELSE 1
          END
        LIMIT 1
    `, [courseId, gender, ...loweredCandidates, category]);
    return rows[0] || null;
};

const findApplicationByStudentAndCycle = async (studentId, _academicCycle = null) => {
    const academicCycle = _academicCycle || null;
    const [rows] = await pool.query(`
        SELECT *
        FROM scholarship_applications
        WHERE student_id = ?
          AND (? IS NULL OR academic_cycle = ? OR academic_cycle IS NULL)
        ORDER BY
            CASE
                WHEN academic_cycle = ? THEN 0
                WHEN academic_cycle IS NULL THEN 1
                ELSE 2
            END,
            submitted_at DESC
        LIMIT 1
    `, [studentId, academicCycle, academicCycle, academicCycle]);
    return rows[0] || null;
};

const findApplicationByIdAndCycle = async (applicationId, _academicCycle = null) => {
    const academicCycle = _academicCycle || null;
    const [rows] = await pool.query(`
        SELECT *
        FROM scholarship_applications
        WHERE application_id = ?
          AND (? IS NULL OR academic_cycle = ? OR academic_cycle IS NULL)
        ORDER BY
            CASE
                WHEN academic_cycle = ? THEN 0
                WHEN academic_cycle IS NULL THEN 1
                ELSE 2
            END,
            submitted_at DESC
        LIMIT 1
    `, [applicationId, academicCycle, academicCycle, academicCycle]);
    return rows[0] || null;
};

const upsertScholarshipApplication = async (connection, data) => {
    const {
        studentId,
        academicCycle,
        applicationId,
        extractedApplicationId,
        formPath,
        formOriginalName
    } = data;

    await connection.query(`
        INSERT INTO scholarship_applications (
            student_id, academic_cycle, application_id, application_id_extracted,
            form_path, form_original_name, match_status, submission_status,
            ocr_status, ocr_error, ocr_attempts, last_ocr_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'matched', 'pending_verification', 'queued', NULL, 0, NULL)
        ON DUPLICATE KEY UPDATE
            application_id = VALUES(application_id),
            application_id_extracted = VALUES(application_id_extracted),
            form_path = VALUES(form_path),
            form_original_name = VALUES(form_original_name),
            match_status = 'matched',
            submission_status = 'pending_verification',
            ocr_status = 'queued',
            ocr_error = NULL,
            ocr_attempts = 0,
            last_ocr_at = NULL,
            submitted_at = CURRENT_TIMESTAMP,
            approved_at = NULL,
            approved_by = NULL,
            rejected_at = NULL,
            rejected_by = NULL,
            rejection_reason = NULL
    `, [studentId, academicCycle, applicationId, extractedApplicationId, formPath, formOriginalName]);
    
    const [rows] = await connection.query("SELECT * FROM scholarship_applications WHERE student_id = ?", [studentId]);
    return rows[0];
};

const createScholarshipOcrJob = async (connection, applicationRecordId) => {
    const [result] = await connection.query(`
        INSERT INTO scholarship_ocr_jobs (
            application_record_id, status, attempts, last_error, available_at, locked_at, processed_at
        )
        VALUES (?, 'queued', 0, NULL, CURRENT_TIMESTAMP, NULL, NULL)
    `, [applicationRecordId]);

    const [rows] = await connection.query("SELECT * FROM scholarship_ocr_jobs WHERE id = ?", [result.insertId]);
    return rows[0] || null;
};

const getScholarshipApplicationById = async (applicationRecordId) => {
    const [rows] = await pool.query(`
        SELECT *
        FROM scholarship_applications
        WHERE id = ?
        LIMIT 1
    `, [applicationRecordId]);
    return rows[0] || null;
};

const claimNextScholarshipOcrJob = async (connection) => {
    const [rows] = await connection.query(`
        SELECT *
        FROM scholarship_ocr_jobs
        WHERE status = 'queued'
          AND available_at <= CURRENT_TIMESTAMP
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE
    `);

    const job = rows[0];
    if (!job) return null;

    await connection.query(`
        UPDATE scholarship_ocr_jobs
        SET status = 'processing',
            locked_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [job.id]);

    return { ...job, status: "processing" };
};

const markScholarshipApplicationOcrProcessing = async (connection, applicationRecordId) => {
    await connection.query(`
        UPDATE scholarship_applications
        SET ocr_status = 'processing',
            ocr_error = NULL
        WHERE id = ?
    `, [applicationRecordId]);
};

const markScholarshipApplicationOcrResult = async (connection, {
    applicationRecordId,
    extractedApplicationId,
    ocrStatus,
    ocrError = null
}) => {
    await connection.query(`
        UPDATE scholarship_applications
        SET application_id_extracted = ?,
            ocr_status = ?,
            ocr_error = ?,
            ocr_attempts = ocr_attempts + 1,
            last_ocr_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [extractedApplicationId, ocrStatus, ocrError, applicationRecordId]);
};

const markScholarshipOcrJobCompleted = async (connection, jobId) => {
    await connection.query(`
        UPDATE scholarship_ocr_jobs
        SET status = 'completed',
            attempts = attempts + 1,
            last_error = NULL,
            processed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [jobId]);
};

const markScholarshipOcrJobFailed = async (connection, jobId, errorMessage) => {
    await connection.query(`
        UPDATE scholarship_ocr_jobs
        SET status = 'failed',
            attempts = attempts + 1,
            last_error = ?,
            processed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [errorMessage, jobId]);
};

const createScholarshipAuditLog = async (connection, data) => {
    const {
        applicationRecordId = null,
        actorUserId = null,
        actorRole,
        action,
        details = {}
    } = data;

    await connection.query(`
        INSERT INTO scholarship_audit_logs (
            application_id, actor_user_id, actor_role, action, details
        )
        VALUES (?, ?, ?, ?, ?)
    `, [applicationRecordId, actorUserId, actorRole, action, JSON.stringify(details || {})]);
};

const getStudentApplicationByStudentAndCycle = async (studentId, _academicCycle = null) => {
    const academicCycle = _academicCycle || null;
    const [rows] = await pool.query(`
        SELECT sa.id, sa.student_id, sa.academic_cycle, sa.application_id, sa.application_id_extracted,
               sa.form_path, sa.form_original_name, sa.match_status, sa.submission_status,
               sa.ocr_status, sa.ocr_error, sa.ocr_attempts, sa.last_ocr_at,
               sa.submitted_at, sa.approved_at, sa.rejected_at, sa.rejection_reason,
               s.full_name
        FROM scholarship_applications sa
        JOIN students s ON s.id = sa.student_id
        WHERE sa.student_id = ?
          AND (? IS NULL OR sa.academic_cycle = ? OR sa.academic_cycle IS NULL)
        ORDER BY
            CASE
                WHEN sa.academic_cycle = ? THEN 0
                WHEN sa.academic_cycle IS NULL THEN 1
                ELSE 2
            END,
            sa.submitted_at DESC
        LIMIT 1
    `, [studentId, academicCycle, academicCycle, academicCycle]);
    return rows[0] || null;
};

const listApplicationsForAdmin = async () => {
    const [rows] = await pool.query(`
        SELECT sa.id, sa.student_id, sa.academic_cycle, sa.application_id, sa.application_id_extracted,
               sa.form_path, sa.form_original_name, sa.match_status, sa.submission_status,
               sa.ocr_status, sa.ocr_error, sa.ocr_attempts, sa.last_ocr_at,
               sa.submitted_at, sa.approved_at, sa.rejected_at, sa.rejection_reason,
               s.full_name, s.course_id, s.caste_category, s.gender, c.course_name
        FROM scholarship_applications sa
        JOIN students s ON s.id = sa.student_id
        JOIN courses c ON c.id = s.course_id
        ORDER BY sa.submitted_at DESC
    `);
    return rows;
};

const getPendingApplicationsByCycle = async (_academicCycle = null) => {
    const academicCycle = _academicCycle || null;
    const [rows] = await pool.query(`
        SELECT sa.*, s.full_name
        FROM scholarship_applications sa
        JOIN students s ON s.id = sa.student_id
        WHERE sa.submission_status = 'pending_verification'
          AND (? IS NULL OR sa.academic_cycle = ? OR sa.academic_cycle IS NULL)
        ORDER BY
            CASE
                WHEN sa.academic_cycle = ? THEN 0
                WHEN sa.academic_cycle IS NULL THEN 1
                ELSE 2
            END,
            sa.submitted_at DESC
    `, [academicCycle, academicCycle, academicCycle]);
    return rows;
};

const getApplicationsByIdsAndCycle = async (applicationIds, _academicCycle = null) => {
    if (!applicationIds.length) return [];
    const academicCycle = _academicCycle || null;
    const placeholders = applicationIds.map(() => "?").join(",");
    const [rows] = await pool.query(`
        SELECT sa.*, s.full_name
        FROM scholarship_applications sa
        JOIN students s ON s.id = sa.student_id
        WHERE sa.application_id IN (${placeholders})
          AND (? IS NULL OR sa.academic_cycle = ? OR sa.academic_cycle IS NULL)
        ORDER BY
            CASE
                WHEN sa.academic_cycle = ? THEN 0
                WHEN sa.academic_cycle IS NULL THEN 1
                ELSE 2
            END,
            sa.submitted_at DESC
    `, [...applicationIds, academicCycle, academicCycle, academicCycle]);
    return rows;
};

const markApplicationApproved = async (connection, applicationRecordId, approverUserId) => {
    await connection.query(`
        UPDATE scholarship_applications
        SET submission_status = 'approved',
            approved_at = CURRENT_TIMESTAMP,
            approved_by = ?
        WHERE id = ?
    `, [approverUserId, applicationRecordId]);
    
    const [rows] = await connection.query("SELECT * FROM scholarship_applications WHERE id = ?", [applicationRecordId]);
    return rows[0] || null;
};

const markApplicationConflict = async (connection, applicationRecordId, actorUserId, reason = "Duplicate application ID in uploaded gov sheet") => {
    await connection.query(`
        UPDATE scholarship_applications
        SET submission_status = 'conflict',
            rejected_at = CURRENT_TIMESTAMP,
            rejected_by = ?,
            rejection_reason = ?
        WHERE id = ?
    `, [actorUserId, reason, applicationRecordId]);
    
    const [rows] = await connection.query("SELECT * FROM scholarship_applications WHERE id = ?", [applicationRecordId]);
    return rows[0] || null;
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
    getStudentOutstandingSummary,
    getOutstandingSummariesByStudentIds,
    getScholarshipConfigForStudent,
    findApplicationByStudentAndCycle,
    findApplicationByIdAndCycle,
    upsertScholarshipApplication,
    createScholarshipOcrJob,
    getScholarshipApplicationById,
    claimNextScholarshipOcrJob,
    markScholarshipApplicationOcrProcessing,
    markScholarshipApplicationOcrResult,
    markScholarshipOcrJobCompleted,
    markScholarshipOcrJobFailed,
    createScholarshipAuditLog,
    getStudentApplicationByStudentAndCycle,
    listApplicationsForAdmin,
    getPendingApplicationsByCycle,
    getApplicationsByIdsAndCycle,
    markApplicationApproved,
    markApplicationConflict
};
