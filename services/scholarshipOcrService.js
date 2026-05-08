import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";
import scholarshipModel from "../models/scholarshipModel.js";
import { withTransaction } from "../utils/dbUtils.js";
import { extractApplicationIdFromPdfText, normalizeApplicationId, textContainsApplicationId } from "../utils/scholarshipParser.js";

const extractTextFromImage = async (imagePath) => {
    const worker = await createWorker("eng");
    try {
        const { data } = await worker.recognize(imagePath);
        return data?.text || "";
    } finally {
        await worker.terminate();
    }
};

const resolveAbsoluteUploadPath = (publicPath = "") => {
    if (!publicPath) return null;
    if (path.isAbsolute(publicPath)) return publicPath;
    const uploadsRoot = process.env.UPLOADS_ROOT
        ? path.resolve(process.cwd(), process.env.UPLOADS_ROOT)
        : path.resolve(process.cwd(), "uploads");
    if (publicPath.startsWith("/uploads/")) {
        return path.resolve(uploadsRoot, publicPath.replace(/^\/uploads\//, ""));
    }
    return path.resolve(process.cwd(), publicPath);
};

const detectApplicationIdFromFile = async (application) => {
    const absoluteFilePath = resolveAbsoluteUploadPath(application.form_path);
    if (!absoluteFilePath) {
        throw new Error("Uploaded file path is missing");
    }

    const fileExt = path.extname(application.form_original_name || absoluteFilePath).toLowerCase();
    let detectedText = "";

    if (fileExt === ".pdf") {
        const fileBuffer = await fs.promises.readFile(absoluteFilePath);
        const parser = new PDFParse({ data: fileBuffer });
        const parsed = await parser.getText();
        await parser.destroy();
        detectedText = parsed?.text || "";
    } else {
        detectedText = await extractTextFromImage(absoluteFilePath);
    }

    const extractedId = extractApplicationIdFromPdfText(detectedText.toUpperCase());
    if (extractedId) {
        return {
            detectedText,
            extractedApplicationId: extractedId,
            ocrStatus: extractedId === normalizeApplicationId(application.application_id) ? "completed" : "mismatch"
        };
    }

    if (textContainsApplicationId(detectedText, application.application_id)) {
        return {
            detectedText,
            extractedApplicationId: normalizeApplicationId(application.application_id),
            ocrStatus: "completed"
        };
    }

    return {
        detectedText,
        extractedApplicationId: null,
        ocrStatus: "failed"
    };
};

const processNextScholarshipOcrJob = async () => {
    const claimed = await withTransaction(async (connection) => {
        const job = await scholarshipModel.claimNextScholarshipOcrJob(connection);
        if (!job) return null;
        await scholarshipModel.markScholarshipApplicationOcrProcessing(connection, job.application_record_id);
        return job;
    });

    if (!claimed) return null;

    const application = await scholarshipModel.getScholarshipApplicationById(claimed.application_record_id);
    if (!application) {
        await withTransaction(async (connection) => {
            await scholarshipModel.markScholarshipOcrJobFailed(connection, claimed.id, "Scholarship application record not found");
        });
        return { processed: true, status: "failed", jobId: claimed.id };
    }

    try {
        const result = await detectApplicationIdFromFile(application);
        const normalizedManualId = normalizeApplicationId(application.application_id);
        const ocrError = result.ocrStatus === "failed"
            ? "Application ID was not detected in the uploaded file"
            : (result.ocrStatus === "mismatch"
                ? `OCR found ${result.extractedApplicationId}, expected ${normalizedManualId}`
                : null);

        await withTransaction(async (connection) => {
            await scholarshipModel.markScholarshipApplicationOcrResult(connection, {
                applicationRecordId: application.id,
                extractedApplicationId: result.extractedApplicationId,
                ocrStatus: result.ocrStatus,
                ocrError
            });

            await scholarshipModel.markScholarshipOcrJobCompleted(connection, claimed.id);
            await scholarshipModel.createScholarshipAuditLog(connection, {
                applicationRecordId: application.id,
                actorUserId: null,
                actorRole: "system",
                action: "ocr_processed",
                details: {
                    application_id: normalizedManualId,
                    extracted_application_id: result.extractedApplicationId,
                    ocr_status: result.ocrStatus
                }
            });
        });

        return {
            processed: true,
            status: result.ocrStatus,
            jobId: claimed.id,
            applicationId: application.id
        };
    } catch (error) {
        const message = String(error?.message || "OCR processing failed").slice(0, 255);
        await withTransaction(async (connection) => {
            await scholarshipModel.markScholarshipApplicationOcrResult(connection, {
                applicationRecordId: application.id,
                extractedApplicationId: application.application_id_extracted || null,
                ocrStatus: "failed",
                ocrError: message
            });
            await scholarshipModel.markScholarshipOcrJobFailed(connection, claimed.id, message);
            await scholarshipModel.createScholarshipAuditLog(connection, {
                applicationRecordId: application.id,
                actorUserId: null,
                actorRole: "system",
                action: "ocr_failed",
                details: {
                    application_id: normalizeApplicationId(application.application_id),
                    error: message
                }
            });
        });

        return {
            processed: true,
            status: "failed",
            jobId: claimed.id,
            applicationId: application.id,
            error: message
        };
    }
};

export default {
    processNextScholarshipOcrJob
};
