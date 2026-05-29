import scholarshipModel from "../models/scholarshipModel.js";
import paymentModel from "../models/paymentModel.js";
import { generateReceiptNumber } from "../utils/receiptGenerator.js";
import { withTransaction, withTransactionSilent } from "../utils/dbUtils.js";
import { CustomError, ErrorCodes } from "../utils/customError.js";
import { getAcademicCycle, normalizeApplicationId } from "../utils/scholarshipParser.js";
import { uploadScholarshipForm, deleteStoredScholarshipForm, getScholarshipFormAccessUrl } from "./fileStorageService.js";

const getCourseScholarshipConfig = async (courseId) => {
    return await scholarshipModel.getConfigByCourse(courseId);
};

const attachScholarshipFormUrls = async (application, requestOrigin) => {
    if (!application) {
        return null;
    }

    const resolvedFormUrl = await getScholarshipFormAccessUrl({
        storedPath: application.form_path,
        requestOrigin
    });

    return {
        ...application,
        stored_form_path: application.form_path,
        form_path: resolvedFormUrl,
        form_url: resolvedFormUrl
    };
};

const updateCourseScholarshipConfig = async (courseId, configs) => {
    return await withTransaction(async (client) => {
        for (const { caste_category, gender, max_amount } of configs) {
            await scholarshipModel.upsertConfig(client, courseId, caste_category, gender, max_amount);
        }
        return { message: "Scholarship configuration updated" };
    });
};

const ensureStudentEligibility = async (studentId) => {
    const student = await scholarshipModel.getStudentForScholarship(studentId);
    if (!student) {
        throw new CustomError({
            message: "Student profile not found",
            statusCode: 404,
            code: ErrorCodes.NOT_FOUND
        });
    }
    const config = await scholarshipModel.getScholarshipConfigForStudent(student.course_id, student.caste_category, student.gender);
    if (!config || Number(config.max_amount) <= 0) {
        throw new CustomError({
            message: "Student is not eligible for scholarship submission",
            statusCode: 403,
            code: ErrorCodes.FORBIDDEN
        });
    }
    return student;
};

const submitScholarshipApplication = async ({ actorUserId, actorRole, manualApplicationId, file }) => {
    if (!file?.buffer?.length) {
        throw new CustomError({
            message: "Scholarship form PDF is required",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }

    const normalizedManualId = normalizeApplicationId(manualApplicationId);
    if (!normalizedManualId || normalizedManualId.length < 6) {
        throw new CustomError({
            message: "Invalid application ID. Use at least 6 alphanumeric characters",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }

    const studentId = await scholarshipModel.getStudentIdByUserId(actorUserId);
    if (!studentId) {
        throw new CustomError({
            message: "Student account mapping not found",
            statusCode: 404,
            code: ErrorCodes.NOT_FOUND
        });
    }

    await ensureStudentEligibility(studentId);
    const academicCycle = getAcademicCycle();

    const duplicateOwner = await scholarshipModel.findApplicationByIdAndCycle(normalizedManualId, academicCycle);
    if (duplicateOwner && Number(duplicateOwner.student_id) !== Number(studentId)) {
        throw new CustomError({
            message: "Application ID already used by another student",
            statusCode: 409,
            code: ErrorCodes.DUPLICATE_ENTRY
        });
    }

    const storedFormPath = await uploadScholarshipForm({
        buffer: file.buffer,
        originalName: file.originalname || "scholarship_form.pdf",
        mimeType: file.mimetype,
        studentId,
        applicationId: normalizedManualId
    });

    const existing = await scholarshipModel.findApplicationByStudentAndCycle(studentId, academicCycle);

    try {
        const saved = await withTransaction(async (client) => {
            const persisted = await scholarshipModel.upsertScholarshipApplication(client, {
                studentId,
                academicCycle,
                applicationId: normalizedManualId,
                extractedApplicationId: null,
                formPath: storedFormPath,
                formOriginalName: file.originalname || "scholarship_form.pdf"
            });

            await scholarshipModel.createScholarshipOcrJob(client, persisted.id);

            await scholarshipModel.createScholarshipAuditLog(client, {
                applicationRecordId: persisted.id,
                actorUserId,
                actorRole,
                action: "submitted",
                details: {
                    application_id: normalizedManualId,
                    ocr_status: "queued"
                }
            });

            return persisted;
        });

        if (existing?.form_path && existing.form_path !== storedFormPath) {
            await deleteStoredScholarshipForm(existing.form_path);
        }

    return {
        id: saved.id,
        student_id: saved.student_id,
        academic_cycle: saved.academic_cycle,
        application_id: saved.application_id,
        application_id_extracted: saved.application_id_extracted,
        stored_form_path: saved.form_path,
        form_path: saved.form_path,
        form_url: saved.form_path,
        ocr_status: saved.ocr_status,
        ocr_error: saved.ocr_error,
        submission_status: saved.submission_status,
        submitted_at: saved.submitted_at
    };
    } catch (error) {
        await deleteStoredScholarshipForm(storedFormPath);
        throw error;
    }
};

const getScholarshipApplicationFormAccessUrl = async ({ applicationId, actorUserId, actorRole, requestOrigin }) => {
    const application = await scholarshipModel.getScholarshipApplicationById(applicationId);
    if (!application) {
        throw new CustomError({
            message: "Scholarship application not found",
            statusCode: 404,
            code: ErrorCodes.NOT_FOUND
        });
    }

    if (actorRole === "student") {
        const studentId = await scholarshipModel.getStudentIdByUserId(actorUserId);
        if (!studentId || Number(application.student_id) !== Number(studentId)) {
            throw new CustomError({
                message: "Forbidden",
                statusCode: 403,
                code: ErrorCodes.FORBIDDEN
            });
        }
    }

    const url = await getScholarshipFormAccessUrl({
        storedPath: application.form_path,
        requestOrigin
    });

    return {
        url,
        expires_in_seconds: Number(process.env.S3_SIGNED_URL_EXPIRES_SECONDS || 900)
    };
};

const getMyScholarshipApplication = async ({ actorUserId, requestOrigin }) => {
    const studentId = await scholarshipModel.getStudentIdByUserId(actorUserId);
    if (!studentId) {
        throw new CustomError({
            message: "Student account mapping not found",
            statusCode: 404,
            code: ErrorCodes.NOT_FOUND
        });
    }
    const application = await scholarshipModel.getStudentApplicationByStudentAndCycle(studentId, getAcademicCycle());
    if (!application) {
        return null;
    }

    return attachScholarshipFormUrls(application, requestOrigin);
};

const listStudentApplications = async ({ requestOrigin }) => {
    const applications = await scholarshipModel.listApplicationsForAdmin();

    return Promise.all(applications.map((application) => attachScholarshipFormUrls(application, requestOrigin)));
};

const reconcileGovSheetRows = async ({ actorUserId, actorRole, rows = [] }) => {
    const academicCycle = getAcademicCycle();
    const normalizedGovRows = rows.map((row, idx) => ({
        row_index: idx,
        application_id: normalizeApplicationId(row.application_id || row.id || ""),
        name: row.name || "",
        category: row.category || row.caste || "",
        amount: Number(row.amount || 0),
        installment_no: Number(row.installment_no || row.installment || 1),
        raw: row
    })).filter((row) => row.application_id);

    const idCounts = new Map();
    normalizedGovRows.forEach((row) => {
        idCounts.set(row.application_id, (idCounts.get(row.application_id) || 0) + 1);
    });
    const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id);

    const appIds = [...new Set(normalizedGovRows.map((row) => row.application_id))];
    const [pendingApps, matchedApps] = await Promise.all([
        scholarshipModel.getPendingApplicationsByCycle(academicCycle),
        scholarshipModel.getApplicationsByIdsAndCycle(appIds, academicCycle)
    ]);

    const pendingMap = new Map(pendingApps.map((item) => [item.application_id, item]));
    const matchedMap = new Map(matchedApps.map((item) => [item.application_id, item]));
    const matched = [];
    const govNotInPortal = [];

    for (const row of normalizedGovRows) {
        if (duplicateIds.includes(row.application_id)) {
            const record = matchedMap.get(row.application_id);
            if (record) {
                await withTransaction(async (client) => {
                    await scholarshipModel.markApplicationConflict(client, record.id, actorUserId);
                    await scholarshipModel.createScholarshipAuditLog(client, {
                        applicationRecordId: record.id,
                        actorUserId,
                        actorRole,
                        action: "conflict_marked",
                        details: {
                            reason: "duplicate_in_gov_sheet",
                            application_id: row.application_id
                        }
                    });
                });
            }
            continue;
        }

        const app = pendingMap.get(row.application_id);
        if (app) {
            matched.push({
                application_id: row.application_id,
                student_id: app.student_id,
                student_name: app.full_name,
                amount: row.amount,
                installment_no: row.installment_no,
                application_record_id: app.id
            });
        } else {
            govNotInPortal.push(row);
        }
    }

    const govIdSet = new Set(normalizedGovRows.map((row) => row.application_id));
    const portalNotInGov = pendingApps.filter((app) => !govIdSet.has(app.application_id));

    return {
        academic_cycle: academicCycle,
        summary: {
            matched_count: matched.length,
            portal_not_in_gov_count: portalNotInGov.length,
            gov_not_in_portal_count: govNotInPortal.length,
            conflicts_count: duplicateIds.length,
            fully_paid_count: 0
        },
        matched,
        portal_not_in_gov: portalNotInGov.map((app) => ({
            application_id: app.application_id,
            student_id: app.student_id,
            student_name: app.full_name,
            submitted_at: app.submitted_at
        })),
        gov_not_in_portal: govNotInPortal,
        conflicts: duplicateIds,
        fully_paid_records: []
    };
};

const disburseScholarshipBatch = async (disbursements, actor = {}) => {
    const results = [];

    for (const record of disbursements) {
        const { student_id, amount, installment_no, application_id, academic_year_num } = record;

        const res = await withTransactionSilent(async (client) => {
            const student = await scholarshipModel.getStudentAndLedgerForUpdate(client, student_id, academic_year_num);
            if (!student) throw new CustomError({
                message: "Student or academic year ledger not found",
                statusCode: 404,
                code: ErrorCodes.NOT_FOUND
            });

            const normalizedAppId = normalizeApplicationId(application_id);
            if (!normalizedAppId) throw new CustomError({
                message: "Application ID is required",
                statusCode: 400,
                code: ErrorCodes.VALIDATION_ERROR
            });

            const applicationRecord = await scholarshipModel.findApplicationByIdAndCycle(normalizedAppId);
            if (applicationRecord && Number(applicationRecord.student_id) !== Number(student_id)) {
                throw new CustomError({
                    message: "Application ID belongs to another student",
                    statusCode: 409,
                    code: ErrorCodes.CONFLICT
                });
            }

            // Auto-resolve self-owned conflict during disbursal: if application belongs to the
            // same student, we allow processing and mark it approved after successful txn.
            // Cross-student conflicts are still blocked by the check above.
            if (applicationRecord && applicationRecord.submission_status === "conflict" && Number(applicationRecord.student_id) !== Number(student_id)) {
                throw new CustomError({
                    message: "Application is in conflict state and must be resolved first",
                    statusCode: 409,
                    code: ErrorCodes.CONFLICT
                });
            }

            if (await scholarshipModel.checkDuplicateDisbursal(client, student_id, normalizedAppId, installment_no)) {
                throw new CustomError({
                    message: "Duplicate disbursal detected",
                    statusCode: 409,
                    code: ErrorCodes.DUPLICATE_ENTRY
                });
            }

            const config = await scholarshipModel.getScholarshipConfig(client, student.course_id, student.caste_category, student.gender);
            if (!config) throw new CustomError({
                message: `No limit configured for ${student.caste_category} ${student.gender}`,
                statusCode: 400,
                code: ErrorCodes.VALIDATION_ERROR
            });

            const maxAmount = parseFloat(config.max_amount);
            const totalReceived = await scholarshipModel.getTotalReceivedForAcademicYear(
                client,
                student_id,
                academic_year_num
            );
            if (totalReceived >= maxAmount) throw new CustomError({
                message: `Limit reached (${maxAmount})`,
                statusCode: 400,
                code: ErrorCodes.OVERPAYMENT,
                details: {
                    max_amount: maxAmount,
                    total_received: totalReceived
                }
            });

            const requestedAmount = parseFloat(amount);
            const remainingLimit = Math.max(0, maxAmount - totalReceived);
            const approvedAmount = Math.min(requestedAmount, remainingLimit);
            if (approvedAmount <= 0) throw new CustomError({
                message: "No amount applicable (scholarship limit reached)",
                statusCode: 400,
                code: ErrorCodes.OVERPAYMENT
            });

            const overCollectionFromPrev = await paymentModel.getOverCollectionForYear(student_id, academic_year_num);
            const adjustedFee = Math.max(0, parseFloat(student.total_yearly_fee || 0) - overCollectionFromPrev);
            const pendingFee = Math.max(0, adjustedFee - parseFloat(student.total_paid || 0));
            const appliedAmount = Math.min(approvedAmount, pendingFee);
            const overCollectionAmount = Math.max(0, approvedAmount - appliedAmount);

            const receiptNumber = await generateReceiptNumber();
            const txn = await scholarshipModel.createTransaction(client, {
                student_id, ledger_id: student.ledger_id, amount: approvedAmount,
                mode: "Scholarship", reference: `APP-${normalizedAppId}-INST-${installment_no}`,
                receiptNumber, remarks: `Scholarship Inst ${installment_no}`,
                appId: normalizedAppId, instNo: installment_no
            });

            const newTotalPaid = parseFloat(student.total_paid) + appliedAmount;
            const status = newTotalPaid >= adjustedFee ? "Paid" : (newTotalPaid > 0 ? "Partial" : "Pending");

            await scholarshipModel.updateLedgerStatus(client, student.ledger_id, newTotalPaid, status);
            if (overCollectionAmount > 0) {
                await scholarshipModel.insertOverCollection(client, {
                    studentId: student_id,
                    fromYearNum: Number(academic_year_num),
                    carryToYearNum: Number(academic_year_num) + 1,
                    amount: overCollectionAmount,
                    sourceTxnId: txn.id
                });
            }

            if (applicationRecord && applicationRecord.submission_status !== "approved") {
                const approvedRecord = await scholarshipModel.markApplicationApproved(client, applicationRecord.id, actor.actorUserId || null);
                await scholarshipModel.createScholarshipAuditLog(client, {
                    applicationRecordId: approvedRecord?.id || applicationRecord.id,
                    actorUserId: actor.actorUserId || null,
                    actorRole: actor.actorRole || "system",
                    action: "approved",
                    details: {
                        reason: "disbursal_processed",
                        installment_no,
                        amount_applied: appliedAmount,
                        receipt_number: txn.receipt_number
                    }
                });
            }

            return {
                student_name: student.full_name,
                amount_approved: approvedAmount,
                amount_applied: appliedAmount,
                over_collection: overCollectionAmount,
                receipt_number: txn.receipt_number,
                application_id: normalizedAppId,
                verification_status: applicationRecord ? applicationRecord.submission_status : "not_submitted"
            };
        });

        if (res.success) {
            results.push({ student_id, status: "success", ...res.result });
        } else {
            results.push({
                student_id,
                status: "failed",
                amount_requested: amount,
                error: res.error.message,
                error_code: res.error.code || ErrorCodes.INTERNAL_ERROR,
                status_code: res.error.statusCode || 500,
                timestamp: res.error.timestamp || new Date().toISOString()
            });
        }
    }
    return results;
};

const getScholarshipSummary = async () => {
    return await scholarshipModel.getSummary();
};

const reverseScholarship = async (txnId) => {
    return await withTransaction(async (client) => {
        const txn = await scholarshipModel.getTransactionWithLedger(client, txnId);
        if (!txn || txn.status === "Reversed") throw new CustomError({
            message: !txn ? "Transaction not found" : "Transaction already reversed",
            statusCode: !txn ? 404 : 409,
            code: !txn ? ErrorCodes.NOT_FOUND : ErrorCodes.CONFLICT
        });

        const newTotalPaid = parseFloat(txn.total_paid) - parseFloat(txn.amount_paid);
        const totalYearlyFee = parseFloat(txn.total_yearly_fee);
        const status = newTotalPaid >= totalYearlyFee ? "Paid" : (newTotalPaid > 0 ? "Partial" : "Pending");

        await scholarshipModel.updateLedgerStatus(client, txn.ledger_id, newTotalPaid, status);
        await scholarshipModel.markAsReversed(client, txnId);
        return { message: "Reversed successfully" };
    });
};

export default {
    getCourseScholarshipConfig, updateCourseScholarshipConfig,
    disburseScholarshipBatch, getScholarshipSummary, reverseScholarship,
    submitScholarshipApplication, getMyScholarshipApplication,
    listStudentApplications, reconcileGovSheetRows,
    getScholarshipApplicationFormAccessUrl
};
