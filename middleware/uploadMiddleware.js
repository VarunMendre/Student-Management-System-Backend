import multer from "multer";
import { CustomError, ErrorCodes } from "../utils/customError.js";

const fileFilter = (_req, file, cb) => {
    const allowed = new Set([
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png"
    ]);

    if (!allowed.has(file.mimetype)) {
        cb(new Error("Only PDF, JPG, JPEG, and PNG files are allowed"));
        return;
    }
    cb(null, true);
};

const hasPdfSignature = (buffer) => buffer?.subarray(0, 5).toString() === "%PDF-";
const hasPngSignature = (buffer) => buffer?.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
const hasJpegSignature = (buffer) => buffer?.subarray(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF]));

export const assertScholarshipFileIsSafe = (file) => {
    if (!file?.buffer?.length) {
        throw new CustomError({
            message: "Scholarship form file is required",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }

    const mimeType = file.mimetype;
    const isValidSignature = (
        (mimeType === "application/pdf" && hasPdfSignature(file.buffer)) ||
        ((mimeType === "image/png") && hasPngSignature(file.buffer)) ||
        ((mimeType === "image/jpeg" || mimeType === "image/jpg") && hasJpegSignature(file.buffer))
    );

    if (!isValidSignature) {
        throw new CustomError({
            message: "Uploaded file content does not match the declared file type",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }
};

export const scholarshipFormUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: {
        fileSize: 8 * 1024 * 1024 // 8MB
    }
});
