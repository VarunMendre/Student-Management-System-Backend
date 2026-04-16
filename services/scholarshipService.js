import scholarshipModel from "../models/scholarshipModel.js";
import { generateReceiptNumber } from "../utils/receiptGenerator.js";
import { withTransaction, withTransactionSilent } from "../utils/dbUtils.js";
import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";
import { CustomError, ErrorCodes } from "../utils/customError.js";
import { extractApplicationIdFromPdfText, getAcademicCycle, normalizeApplicationId } from "../utils/scholarshipParser.js";

const getCourseScholarshipConfig = async (courseId) => {
    return await scholarshipModel.getConfigByCourse(courseId);
};

const updateCourseScholarshipConfig = async (courseId, configs) => {
    return await withTransaction(async (client) => {
        for (const { caste_category, gender, max_amount } of configs) {
            await scholarshipModel.upsertConfig(client, courseId, caste_category, gender, max_amount);
        }
        return { message: `Scholarship configuration updated` };
    });
};

const resolvePublicUploadPath = (absolutePath) => {
    const uploadsRoot = path.resolve(process.cwd(), "uploads");
    const normalizedAbsolute = path.resolve(absolutePath);
    if (!normalizedAbsolute.startsWith(uploadsRoot)) {
        return null;
    }
    const relativePath = path.relative(uploadsRoot, normalizedAbsolute).replace(/\\/g, "/");
    return `/uploads/${relativePath}`;
};

const deleteFileSafely = async (filePath) => {
    if (!filePath) return;
    try {
        await fs.promises.unlink(filePath);
    } catch (_error) {
        // no-op
    }
};

const extractTextFromImage = async (imagePath) => {
    const worker = await createWorker("eng");
    try {
        const { data } = await worker.recognize(imagePath);
        return data?.text || "";
    } finally {
        await worker.terminate();
    }
};

const ensureStudentEligibility = async (studentId) => {
    const student = await scholarshipModel.getStudentForScholarship(studentId);
    if (!student) {
        throw new CustomError("Student profile not found", 404, ErrorCodes.NOT_FOUND);
    }
    const config = await scholarshipModel.getScholarshipConfigForStudent(student.course_id, student.caste_category, student.gender);
    if (!config || Number(config.max_amount) <= 0) {
        throw new CustomError("Student is not eligible for scholarship submission", 403, ErrorCodes.FORBIDDEN);
    }
    return student;
};

const submitScholarshipApplication = async ({ actorUserId, actorRole, manualApplicationId, file }) => {
    if (!file?.path) {
        throw new CustomError("Scholarship form PDF is required", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const normalizedManualId = normalizeApplicationId(manualApplicationId);
    if (!normalizedManualId || normalizedManualId.length < 6) {
        await deleteFileSafely(file.path);
        throw new CustomError("Invalid application ID. Use at least 6 alphanumeric characters", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const studentId = await scholarshipModel.getStudentIdByUserId(actorUserId);
    if (!studentId) {
        await deleteFileSafely(file.path);
        throw new CustomError("Student account mapping not found", 404, ErrorCodes.NOT_FOUND);
    }

    await ensureStudentEligibility(studentId);
    const academicCycle = getAcademicCycle();

    const duplicateOwner = await scholarshipModel.findApplicationByIdAndCycle(normalizedManualId);
    if (duplicateOwner && Number(duplicateOwner.student_id) !== Number(studentId)) {
        await deleteFileSafely(file.path);
        throw new CustomError("Application ID already used by another student", 409, ErrorCodes.DUPLICATE_ENTRY);
    }

    let extractedId = null;
    try {
        let detectedText = "";
        if (file.mimetype === "application/pdf") {
            const fileBuffer = await fs.promises.readFile(file.path);
            const parser = new PDFParse({ data: fileBuffer });
            const parsed = await parser.getText();
            await parser.destroy();
            detectedText = parsed?.text || "";
        } else {
            detectedText = await extractTextFromImage(file.path);
        }
        extractedId = extractApplicationIdFromPdfText(detectedText.toUpperCase());
    } catch (_error) {
        await deleteFileSafely(file.path);
        throw new CustomError("Could not read uploaded file content. For images, ensure ID text is clear and readable", 422, ErrorCodes.VALIDATION_ERROR);
    }

    if (!extractedId) {
        await deleteFileSafely(file.path);
        throw new CustomError("Application ID was not detected in the uploaded file", 422, ErrorCodes.VALIDATION_ERROR);
    }

    if (normalizedManualId !== extractedId) {
        await deleteFileSafely(file.path);
        throw new CustomError("Entered Application ID does not match the ID found in PDF", 422, ErrorCodes.VALIDATION_ERROR, {
            entered_application_id: normalizedManualId,
            extracted_application_id: extractedId
        });
    }

    const publicFormPath = resolvePublicUploadPath(file.path);
    if (!publicFormPath) {
        await deleteFileSafely(file.path);
        throw new CustomError("Failed to store uploaded file", 500, ErrorCodes.DATABASE_ERROR);
    }

    return await withTransaction(async (client) => {
        const existing = await scholarshipModel.findApplicationByStudentAndCycle(studentId);
        if (existing?.form_path && existing.form_path !== publicFormPath) {
            const oldPath = path.resolve(process.cwd(), existing.form_path.replace(/^\/uploads\//, "uploads/"));
            await deleteFileSafely(oldPath);
        }

        const saved = await scholarshipModel.upsertScholarshipApplication(client, {
            studentId,
            academicCycle,
            applicationId: normalizedManualId,
            extractedApplicationId: extractedId,
            formPath: publicFormPath,
            formOriginalName: file.originalname || "scholarship_form.pdf"
        });

        await scholarshipModel.createScholarshipAuditLog(client, {
            applicationRecordId: saved.id,
            actorUserId,
            actorRole,
            action: "submitted",
            details: {
                application_id: normalizedManualId
            }
        });

        return {
            id: saved.id,
            student_id: saved.student_id,
            academic_cycle: saved.academic_cycle,
            application_id: saved.application_id,
            application_id_extracted: saved.application_id_extracted,
            form_url: saved.form_path,
            submission_status: saved.submission_status,
            submitted_at: saved.submitted_at
        };
    });
};

const getMyScholarshipApplication = async ({ actorUserId }) => {
    const studentId = await scholarshipModel.getStudentIdByUserId(actorUserId);
    if (!studentId) {
        throw new CustomError("Student account mapping not found", 404, ErrorCodes.NOT_FOUND);
    }
    return scholarshipModel.getStudentApplicationByStudentAndCycle(studentId);
};

const listStudentApplications = async () => {
    return scholarshipModel.listApplicationsForAdmin();
};

const reconcileGovSheetRows = async ({ actorUserId, actorRole, rows = [] }) => {
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
        scholarshipModel.getPendingApplicationsByCycle(),
        scholarshipModel.getApplicationsByIdsAndCycle(appIds)
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
        academic_cycle: null,
        summary: {
            matched_count: matched.length,
            portal_not_in_gov_count: portalNotInGov.length,
            gov_not_in_portal_count: govNotInPortal.length,
            conflicts_count: duplicateIds.length
        },
        matched,
        portal_not_in_gov: portalNotInGov.map((app) => ({
            application_id: app.application_id,
            student_id: app.student_id,
            student_name: app.full_name,
            submitted_at: app.submitted_at
        })),
        gov_not_in_portal: govNotInPortal,
        conflicts: duplicateIds
    };
};

const disburseScholarshipBatch = async (disbursements, actor = {}) => {
    const results = [];

    for (const record of disbursements) {
        const { student_id, amount, installment_no, application_id, academic_year_num } = record;
        
        const res = await withTransactionSilent(async (client) => {
            const student = await scholarshipModel.getStudentAndLedgerForUpdate(client, student_id, academic_year_num);
            if (!student) throw new Error("Student or academic year ledger not found");

            const normalizedAppId = normalizeApplicationId(application_id);
            if (!normalizedAppId) throw new Error("Application ID is required");

            const applicationRecord = await scholarshipModel.findApplicationByIdAndCycle(normalizedAppId);
            if (applicationRecord && Number(applicationRecord.student_id) !== Number(student_id)) {
                throw new Error("Application ID belongs to another student");
            }

            if (applicationRecord && applicationRecord.submission_status === "conflict") {
                throw new Error("Application is in conflict state and must be resolved first");
            }

            if (await scholarshipModel.checkDuplicateDisbursal(client, student_id, normalizedAppId, installment_no)) {
                throw new Error("Duplicate disbursal detected");
            }

            const config = await scholarshipModel.getScholarshipConfig(client, student.course_id, student.caste_category, student.gender);
            if (!config) throw new Error(`No limit configured for ${student.caste_category} ${student.gender}`);
            
            const maxAmount = parseFloat(config.max_amount);
            const totalReceived = await scholarshipModel.getTotalReceived(client, student.ledger_id);
            if (totalReceived >= maxAmount) throw new Error(`Limit reached (₹${maxAmount})`);

            let appliedAmount = Math.min(parseFloat(amount), maxAmount - totalReceived, parseFloat(student.pending_fee));
            if (appliedAmount <= 0) throw new Error("No amount applicable (Balance is 0 or limit reached)");

            const receiptNumber = await generateReceiptNumber();
            const txn = await scholarshipModel.createTransaction(client, {
                student_id, ledger_id: student.ledger_id, amount: appliedAmount,
                mode: 'Scholarship', reference: `APP-${normalizedAppId}-INST-${installment_no}`,
                receiptNumber, remarks: `Scholarship Inst ${installment_no}`,
                appId: normalizedAppId, instNo: installment_no
            });

            const newTotalPaid = parseFloat(student.total_paid) + appliedAmount;
            const totalYearlyFee = parseFloat(student.total_yearly_fee);
            let status = newTotalPaid >= totalYearlyFee ? "Paid" : (newTotalPaid > 0 ? "Partial" : "Pending");

            await scholarshipModel.updateLedgerStatus(client, student.ledger_id, newTotalPaid, status);

            if (applicationRecord && applicationRecord.submission_status !== "approved") {
                const approvedRecord = await scholarshipModel.markApplicationApproved(client, applicationRecord.id, actor.actorUserId || null);
                await scholarshipModel.createScholarshipAuditLog(client, {
                    applicationRecordId: approvedRecord?.id || applicationRecord.id,
                    actorUserId: actor.actorUserId || null,
                    actorRole: actor.actorRole || "system",
                    action: "approved",
                    details: {
                        reason: "disbursal_processed",
                        installment_no: installment_no,
                        amount_applied: appliedAmount,
                        receipt_number: txn.receipt_number
                    }
                });
            }

            return {
                student_name: student.full_name,
                amount_applied: appliedAmount,
                receipt_number: txn.receipt_number,
                application_id: normalizedAppId,
                verification_status: applicationRecord ? applicationRecord.submission_status : "not_submitted"
            };
        });

        if (res.success) {
            results.push({ student_id, status: 'success', ...res.result });
        } else {
            results.push({ student_id, status: 'failed', amount_requested: amount, error: res.error.message });
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
        if (!txn || txn.status === 'Reversed') throw new Error(!txn ? "Not found" : "Already reversed");

        const newTotalPaid = parseFloat(txn.total_paid) - parseFloat(txn.amount_paid);
        const totalYearlyFee = parseFloat(txn.total_yearly_fee);
        let status = newTotalPaid >= totalYearlyFee ? "Paid" : (newTotalPaid > 0 ? "Partial" : "Pending");

        await scholarshipModel.updateLedgerStatus(client, txn.ledger_id, newTotalPaid, status);
        await scholarshipModel.markAsReversed(client, txnId);
        return { message: "Reversed successfully" };
    });
};

export default { 
    getCourseScholarshipConfig, updateCourseScholarshipConfig, 
    disburseScholarshipBatch, getScholarshipSummary, reverseScholarship,
    submitScholarshipApplication, getMyScholarshipApplication,
    listStudentApplications, reconcileGovSheetRows
};
