import { CustomError, ErrorCodes } from "../utils/customError.js";
import { getAcademicYearLabels } from "../utils/receiptGenerator.js";
import studentModel from "../models/studentModel.js";
import userModel from "../models/userModel.js";
import { withTransaction } from "../utils/dbUtils.js";
import bcrypt from "bcryptjs";
import { getStudentMetadataOptions } from "../utils/studentOptions.js";

const parseCurrencyFields = (rows = [], fields = []) =>
    rows.map((row) => ({
        ...row,
        ...Object.fromEntries(fields.map((field) => [field, parseFloat(row[field])]))
    }));

const parseLedgerFields = (rows = []) =>
    rows.map((row) => ({
        ...row,
        total_yearly_fee: parseFloat(row.total_yearly_fee),
        total_paid: parseFloat(row.total_paid),
        pending_fee: parseFloat(row.pending_fee)
    }));

const parsePaginationValue = (value, fallback) => {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

const enrollStudent = async (data) => {
    const {
        full_name, email, mobile_number, alternate_number,
        prn_number, eligibility_number,
        department_id, course_id, batch_id,
        caste_category, gender
    } = data;

    const batch = await studentModel.getBatchWithDetails(batch_id);
    if (!batch) throw new CustomError({
        message: "Batch not found",
        statusCode: 404,
        code: ErrorCodes.NOT_FOUND
    });
    if (!batch.is_active) throw new CustomError({
        message: "Batch is inactive",
        statusCode: 400,
        code: ErrorCodes.VALIDATION_ERROR
    });
    if (batch.course_id !== course_id) throw new CustomError({
        message: "Batch mismatch",
        statusCode: 400,
        code: ErrorCodes.VALIDATION_ERROR
    });

    const course = await studentModel.getCourseDeptId(course_id);
    if (!course) throw new CustomError({
        message: "Course not found",
        statusCode: 404,
        code: ErrorCodes.NOT_FOUND
    });
    if (course.department_id !== department_id) throw new CustomError({
        message: "Department mismatch",
        statusCode: 400,
        code: ErrorCodes.VALIDATION_ERROR
    });

    const enrolledCount = await studentModel.getEnrolledCount(batch_id);
    if (enrolledCount >= batch.total_seats) throw new CustomError({
        message: "Batch full",
        statusCode: 409,
        code: ErrorCodes.BATCH_FULL
    });

    const batchFees = await studentModel.getBatchFeesByYear(batch_id);
    const totalCourseFee = Object.values(batchFees).reduce((sum, f) => sum + f, 0);

    if (totalCourseFee <= 0) throw new CustomError({
        message: "No fee components configured for this batch",
        statusCode: 400,
        code: ErrorCodes.VALIDATION_ERROR
    });

    const yearLabels = getAcademicYearLabels(batch.duration);
    console.log("ENROLL DEBUG", {
  batchDuration: batch.duration,
  yearLabels,
  batchFees
});    
    return withTransaction(async (client) => {
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
                ledger: parseCurrencyFields(ledgerRows, ["total_yearly_fee", "total_paid", "pending_fee"])
            }
        };
    }).catch(error => {
        if (error.code === "23505" && error.constraint?.includes("email")) {
            throw new CustomError({
                message: "Email already exists",
                statusCode: 409,
                code: ErrorCodes.DUPLICATE_ENTRY,
                cause: error
            });
        }
        throw error;
    });
};

const getStudentMetadata = async () => getStudentMetadataOptions();

const listStudents = async (filters = {}) => {
    const safePage = parsePaginationValue(filters.page, 1);
    const safeLimit = parsePaginationValue(filters.limit, 10);
    const offset = (safePage - 1) * safeLimit;

    const [initialRows, total] = await Promise.all([
        studentModel.findStudents(filters, { limit: safeLimit, offset }),
        studentModel.countStudents(filters)
    ]);

    await Promise.all(
        initialRows.map((row) => studentModel.syncLedgerFeesFromBatch(row.id))
    );

    const rows = await studentModel.findStudents(filters, { limit: safeLimit, offset });

    return {
        data: rows.map((row) => ({
            ...row,
            total_course_fee: parseFloat(row.total_course_fee),
            total_paid: parseFloat(row.total_paid),
            total_pending: parseFloat(row.total_pending),
            fee_ledger: parseLedgerFields(Array.isArray(row.fee_ledger) ? row.fee_ledger : []),
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
    await studentModel.syncLedgerFeesFromBatch(id);
    const student = await studentModel.findByIdWithDetails(id);
    if (!student) throw new CustomError({
        message: "Student not found",
        statusCode: 404,
        code: ErrorCodes.NOT_FOUND
    });

    const ledger = await studentModel.getLedgerByStudent(id);
    const transactions = await studentModel.getRecentTransactionsByStudent(id);

    return {
        ...student,
        total_course_fee: parseFloat(student.total_course_fee || 0),
        total_paid: parseFloat(student.total_paid || 0),
        total_pending: parseFloat(student.total_pending || 0),
        scholarship_paid: parseFloat(student.scholarship_paid || 0),
        regular_paid: parseFloat(student.regular_paid || 0),
        fee_ledger: parseCurrencyFields(ledger, ["total_yearly_fee", "total_paid", "pending_fee"]),
        recent_transactions: transactions.map((row) => ({
            ...row, amount_paid: parseFloat(row.amount_paid)
        }))
    };
};

const updateStudent = async (id, data) => {
    if (!await studentModel.exists(id)) throw new CustomError({
        message: "Student not found",
        statusCode: 404,
        code: ErrorCodes.NOT_FOUND
    });

    try {
        const updatedStudent = await withTransaction(async (client) => {
            const nextStudent = await studentModel.updateStudentById(id, data);

            if (!nextStudent) {
                return null;
            }

            await userModel.updateStudentLinkedAccount(client, id, {
                name: data.full_name,
                email: data.email,
                contact_number: data.mobile_number
            });

            return nextStudent;
        });

        if (!updatedStudent) {
            throw new CustomError({
                message: "No valid fields provided",
                statusCode: 400,
                code: ErrorCodes.VALIDATION_ERROR
            });
        }

        return updatedStudent;
    } catch (error) {
        if (error.code === "23505" && error.constraint?.includes("email")) {
            throw new CustomError({
                message: "Email already exists",
                statusCode: 409,
                code: ErrorCodes.DUPLICATE_ENTRY,
                cause: error
            });
        }
        throw error;
    }
};

const bulkImportStudents = async (data) => {
    const { department_id, course_id, batch_id, target_year, students } = data;

    // 1. Validate Batch/Course/Dept
    const batch = await studentModel.getBatchWithDetails(batch_id);
    if (!batch) throw new CustomError({ message: "Batch not found", statusCode: 404, code: ErrorCodes.NOT_FOUND });
    if (!batch.is_active) throw new CustomError({ message: "Batch is inactive", statusCode: 400, code: ErrorCodes.VALIDATION_ERROR });
    if (batch.course_id !== course_id) throw new CustomError({ message: "Batch mismatch", statusCode: 400, code: ErrorCodes.VALIDATION_ERROR });

    const course = await studentModel.getCourseDeptId(course_id);
    if (!course) throw new CustomError({ message: "Course not found", statusCode: 404, code: ErrorCodes.NOT_FOUND });
    if (course.department_id !== department_id) throw new CustomError({ message: "Department mismatch", statusCode: 400, code: ErrorCodes.VALIDATION_ERROR });

    // 2. Check Capacity
    const enrolledCount = await studentModel.getEnrolledCount(batch_id);
    if (enrolledCount + students.length > batch.total_seats) {
        throw new CustomError({
            message: `Batch capacity exceeded. Current: ${enrolledCount}, Total: ${batch.total_seats}, Attempted: ${students.length}`,
            statusCode: 409,
            code: ErrorCodes.BATCH_FULL
        });
    }

    // 3. Duplicate checks (Internal & External) — only for students that have an email
    const nonNullEmails = students.map(s => s.email).filter(e => e !== null && e !== undefined && e !== '');
    const internalDuplicates = nonNullEmails.filter((email, index) => nonNullEmails.indexOf(email) !== index);
    if (internalDuplicates.length > 0) {
        throw new CustomError({
            message: `Duplicate emails found in the uploaded file: ${[...new Set(internalDuplicates)].join(", ")}`,
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }

    const existingEmailsInDb = nonNullEmails.length > 0 ? await studentModel.findExistingEmails(nonNullEmails) : [];
    if (existingEmailsInDb.length > 0) {
        throw new CustomError({
            message: `The following emails already exist in the system: ${existingEmailsInDb.join(", ")}`,
            statusCode: 409,
            code: ErrorCodes.DUPLICATE_ENTRY
        });
    }

    // 4. Batch Fees & Labels
    const batchFees = await studentModel.getBatchFeesByYear(batch_id);
    const yearLabels = getAcademicYearLabels(batch.duration);

    // 5. Pre-hash ALL passwords in parallel BEFORE the transaction
    //    bcrypt cost 10 = ~80ms per hash (vs cost 12 = ~300ms).
    //    Parallel hashing: 24 students done in ~80ms total instead of ~7s sequential.
    const hashedPasswords = await Promise.all(
        students.map(s => bcrypt.hash(`${s.mobile_number}`, 10))
    );

    // 6. Transactional Import
    return withTransaction(async (client) => {
        const importedStudents = [];
        for (let idx = 0; idx < students.length; idx++) {
            const studentData = students[idx];

            // Add required parent IDs
            const fullStudentData = {
                ...studentData,
                department_id,
                course_id,
                batch_id
            };

            const student = await studentModel.createStudent(client, fullStudentData);

            await userModel.createStudentUser(client, {
                name: studentData.full_name,
                email: studentData.email,
                password: hashedPasswords[idx],
                contact_number: studentData.mobile_number,
                role: "student",
                student_id: student.id,
                is_password_changed: false
            });

            for (let i = 0; i < yearLabels.length; i++) {
                const yr = yearLabels[i];
                const yearlyFee = batchFees[yr] || 0;
                
                let finalYearlyFee = yearlyFee;
                let finalPaid = 0;
                let finalStatus = yearlyFee > 0 ? "Pending" : "Paid";

                if (yr === target_year) {
                    const importPaid = studentData.total_paid !== undefined ? parseFloat(studentData.total_paid) : 0;
                    const importBalance = studentData.balance !== undefined ? parseFloat(studentData.balance) : 0;
                    
                    finalPaid = importPaid;
                    finalYearlyFee = importPaid + importBalance;
                    if (importBalance === 0) {
                        finalStatus = "Paid";
                    } else if (importPaid > 0) {
                        finalStatus = "Partial";
                    } else {
                        finalStatus = "Pending";
                    }
                }

                await studentModel.createFeeLedger(client, {
                    student_id: student.id,
                    academic_year: yr,
                    academic_year_num: i + 1,
                    total_yearly_fee: finalYearlyFee,
                    total_paid: finalPaid,
                    status: finalStatus
                });
            }
            importedStudents.push(student);
        }
        return { count: importedStudents.length };
    });
};

const getFeeLedgerReport = async (filters = {}) => {
    const safePage = parsePaginationValue(filters.page, 1);
    const safeLimit = parsePaginationValue(filters.limit, 10);
    const offset = (safePage - 1) * safeLimit;
    const queryFilters = {
        ...filters,
        page: undefined,
        limit: undefined
    };

    const initialRows = await studentModel.getFeeLedgerReport(queryFilters, { limit: safeLimit, offset });

    await Promise.all(
        initialRows.map((row) => studentModel.syncLedgerFeesFromBatch(row.id))
    );

    const rows = await studentModel.getFeeLedgerReport(queryFilters, { limit: safeLimit, offset });
    const total = await studentModel.countFeeLedgerReport(queryFilters);

    return {
        data: rows.map((row) => ({
        ...row,
        total_course_fee: parseFloat(row.total_course_fee),
        total_paid: parseFloat(row.total_paid),
        total_pending: parseFloat(row.total_pending),
        fee_ledger: parseLedgerFields(Array.isArray(row.fee_ledger) ? row.fee_ledger : [])
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

export default { 
    enrollStudent, 
    getStudentMetadata, 
    listStudents, 
    getStudentById, 
    updateStudent, 
    bulkImportStudents,
    getFeeLedgerReport
};
