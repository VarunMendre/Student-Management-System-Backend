import fs from "fs";
import os from "os";
import path from "path";
import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";
import scholarshipModel from "../models/scholarshipModel.js";
import { withTransaction } from "../utils/dbUtils.js";
import { extractApplicationIdFromPdfText, normalizeApplicationId, textContainsApplicationId } from "../utils/scholarshipParser.js";
import { getScholarshipFormBuffer } from "./fileStorageService.js";

const extractTextFromImage = async (imageBuffer, originalName = "scholarship_form.png") => {
    const ext = path.extname(originalName || ".png") || ".png";
    const tempFilePath = path.join(os.tmpdir(), `scholarship-ocr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    const worker = await createWorker("eng");

    try {
        await fs.promises.writeFile(tempFilePath, imageBuffer);
        const { data } = await worker.recognize(tempFilePath);
        return data?.text || "";
    } finally {
        await worker.terminate();
        await fs.promises.unlink(tempFilePath).catch(() => {});
    }
};

const detectApplicationIdFromFile = async (application) => {
    if (!application.form_path) {
        throw new Error("Uploaded file path is missing");
    }

    const originalName = application.form_original_name || "scholarship_form.pdf";
    const fileExt = originalName.includes(".") ? originalName.slice(originalName.lastIndexOf(".")).toLowerCase() : ".pdf";
    let detectedText = "";
    const fileBuffer = await getScholarshipFormBuffer(application.form_path);

    if (fileExt === ".pdf") {
        const parser = new PDFParse({ data: fileBuffer });
        const parsed = await parser.getText();
        await parser.destroy();
        detectedText = parsed?.text || "";
    } else {
        detectedText = await extractTextFromImage(fileBuffer, originalName);
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
