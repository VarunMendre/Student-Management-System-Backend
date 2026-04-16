import { CustomError, ErrorCodes } from "../utils/customError.js";
import { getAcademicYearLabels } from "../utils/receiptGenerator.js";
import studentModel from "../models/studentModel.js";
import userModel from "../models/userModel.js";
import { withTransaction } from "../utils/dbUtils.js";
import bcrypt from "bcryptjs";

const enrollStudent = async (data) => {
    const {
        full_name, email, mobile_number, alternate_number,
        prn_number, eligibility_number,
        department_id, course_id, batch_id,
        caste_category, gender
    } = data;

    const batch = await studentModel.getBatchWithDetails(batch_id);
    if (!batch) throw new CustomError("Batch not found", 400, ErrorCodes.NOT_FOUND);
    if (!batch.is_active) throw new CustomError("Batch is inactive", 400, ErrorCodes.VALIDATION_ERROR);
    if (batch.course_id !== course_id) throw new CustomError("Batch mismatch", 400, ErrorCodes.VALIDATION_ERROR);

    const course = await studentModel.getCourseDeptId(course_id);
    if (!course) throw new CustomError("Course not found", 400, ErrorCodes.NOT_FOUND);
    if (course.department_id !== department_id) throw new CustomError("Department mismatch", 400, ErrorCodes.VALIDATION_ERROR);

    const enrolledCount = await studentModel.getEnrolledCount(batch_id);
    if (enrolledCount >= batch.total_seats) throw new CustomError("Batch full", 409, ErrorCodes.BATCH_FULL);

    const batchFees = await studentModel.getBatchFeesByYear(batch_id);
    const totalCourseFee = Object.values(batchFees).reduce((sum, f) => sum + f, 0);

    if (totalCourseFee <= 0) throw new CustomError("No fee components configured for this batch", 400, ErrorCodes.VALIDATION_ERROR);

    const yearLabels = getAcademicYearLabels(batch.duration);
    
    return await withTransaction(async (client) => {
        const student = await studentModel.createStudent(client, data);
        const hashedPassword = await bcrypt.hash(`${mobile_number}`, 12);

        await userModel.createStudentUser(client, {
            name: full_name,
            email,
            password: hashedPassword,
            contact_number: mobile_number,
            role: "student",
            student_id: student.id,
            is_password_changed: false
        });

        const ledgerRows = [];
        for (let i = 0; i < yearLabels.length; i++) {
            const yr = yearLabels[i];
            const yearlyFee = batchFees[yr] || 0;
            const row = await studentModel.createFeeLedger(client, {
                student_id: student.id, academic_year: yr, academic_year_num: i + 1, total_yearly_fee: yearlyFee
            });
            ledgerRows.push(row);
        }
        return {
            ...student,
            department_name: batch.department_name, course_name: batch.course_name, batch_name: batch.batch_name,
            fee_summary: {
                total_course_fee: totalCourseFee, 
                years: yearLabels.length,
                ledger: ledgerRows.map(row => ({
                    ...row, total_yearly_fee: parseFloat(row.total_yearly_fee), total_paid: parseFloat(row.total_paid), pending_fee: parseFloat(row.pending_fee)
                }))
            }
        };
    }).catch(error => {
        if (error.code === "23505" && error.constraint?.includes("email")) {
            throw new CustomError("Email already exists", 409, ErrorCodes.DUPLICATE_ENTRY);
        }
        throw error;
    });
};

const listStudents = async (filters = {}) => {
    const {
        department_id,
        course_id,
        batch_id,
        status,
        search,
        page = 1,
        limit = 10
    } = filters;

    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.max(Number(limit) || 10, 1);
    const offset = (safePage - 1) * safeLimit;

    const selectQuery = `
        SELECT 
            s.id, s.full_name, s.email, s.mobile_number, s.prn_number,
            s.department_id, s.course_id, s.batch_id,
            d.name as department_name, c.course_name, cb.batch_name,
            s.caste_category, s.gender, s.enrollment_status,
            COALESCE(ledger.total_course_fee, 0) as total_course_fee,
            COALESCE(ledger.total_paid, 0) as total_paid,
            COALESCE(ledger.total_pending, 0) as total_pending,
            COALESCE(tx.transaction_count, 0) as transaction_count
        FROM students s
        JOIN departments d ON s.department_id = d.id
        JOIN courses c ON s.course_id = c.id
        JOIN course_batches cb ON s.batch_id = cb.id
        LEFT JOIN (
            SELECT student_id, 
                   SUM(total_yearly_fee) as total_course_fee, 
                   SUM(total_paid) as total_paid,
                   SUM(pending_fee) as total_pending
            FROM student_fee_ledger 
            GROUP BY student_id
        ) ledger ON s.id = ledger.student_id
        LEFT JOIN (
            SELECT student_id, COUNT(id) as transaction_count 
            FROM fee_transactions 
            WHERE status = 'Active'
            GROUP BY student_id
        ) tx ON s.id = tx.student_id
    `;
    let query = selectQuery;
    let countQuery = `
        SELECT COUNT(*) as total
        FROM students s
        JOIN departments d ON s.department_id = d.id
        JOIN courses c ON s.course_id = c.id
        JOIN course_batches cb ON s.batch_id = cb.id
    `;

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (department_id) { conditions.push(`s.department_id = $${paramIndex++}`); values.push(department_id); }
    if (course_id) { conditions.push(`s.course_id = $${paramIndex++}`); values.push(course_id); }
    if (batch_id) { conditions.push(`s.batch_id = $${paramIndex++}`); values.push(batch_id); }
    if (status) { conditions.push(`s.enrollment_status = $${paramIndex++}`); values.push(status); }
    if (search) {
        conditions.push(`(s.full_name ILIKE $${paramIndex} OR s.email ILIKE $${paramIndex} OR s.prn_number ILIKE $${paramIndex})`);
        values.push(`%${search}%`);
        paramIndex++;
    }

    if (conditions.length > 0) {
        const whereClause = " WHERE " + conditions.join(" AND ");
        query += whereClause;
        countQuery += whereClause;
    }

    query += ` ORDER BY s.enrolled_at DESC`;

    const [rows, total] = await Promise.all([
        studentModel.listAll(query, values, { limit: safeLimit, offset }),
        studentModel.countAll(countQuery, values)
    ]);

    return {
        data: rows.map(row => ({
            ...row,
            total_course_fee: parseFloat(row.total_course_fee),
            total_paid: parseFloat(row.total_paid),
            total_pending: parseFloat(row.total_pending),
            transaction_count: parseInt(row.transaction_count, 10)
        })),
        pagination: {
            page: safePage,
            limit: safeLimit,
            total,
            totalPages: Math.ceil(total / safeLimit) || 1,
            hasNext: safePage * safeLimit < total,
            hasPrev: safePage > 1
        }
    };
};

const getStudentById = async (id) => {
    const student = await studentModel.findByIdWithDetails(id);
    if (!student) throw new CustomError("Student not found", 404, ErrorCodes.NOT_FOUND);

    const ledger = await studentModel.getLedgerByStudent(id);
    const transactions = await studentModel.getRecentTransactionsByStudent(id);

    return {
        ...student,
        fee_ledger: ledger.map(row => ({
            ...row, total_yearly_fee: parseFloat(row.total_yearly_fee), total_paid: parseFloat(row.total_paid), pending_fee: parseFloat(row.pending_fee)
        })),
        recent_transactions: transactions.map(row => ({
            ...row, amount_paid: parseFloat(row.amount_paid)
        }))
    };
};

const updateStudent = async (id, data) => {
    if (!await studentModel.exists(id)) throw new CustomError("Student not found", 404, ErrorCodes.NOT_FOUND);

    const allowedFields = ["full_name", "email", "mobile_number", "alternate_number", "prn_number", "eligibility_number", "enrollment_status"];
    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            updates.push(`${field} = $${paramIndex++}`);
            values.push(data[field]);
        }
    }

    if (updates.length === 0) throw new CustomError("No valid fields provided", 400, ErrorCodes.VALIDATION_ERROR);

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `UPDATE students SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING id, full_name, email, mobile_number, alternate_number, prn_number, eligibility_number, enrollment_status, updated_at`;

    try {
        return await studentModel.update(query, values);
    } catch (error) {
        if (error.code === "23505" && error.constraint?.includes("email")) {
            throw new CustomError("Email already exists", 409, ErrorCodes.DUPLICATE_ENTRY);
        }
        throw error;
    }
};

export default { enrollStudent, listStudents, getStudentById, updateStudent };
