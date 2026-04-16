import fs from "fs";
import path from "path";
import multer from "multer";

const scholarshipUploadDir = path.resolve(process.cwd(), "uploads", "scholarship-forms");
fs.mkdirSync(scholarshipUploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, scholarshipUploadDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || ".pdf");
        const base = path.basename(file.originalname || "form", ext).replace(/[^a-zA-Z0-9]/g, "_");
        cb(null, `${Date.now()}_${base}${ext.toLowerCase()}`);
    }
});

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

export const scholarshipFormUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 8 * 1024 * 1024 // 8MB
    }
});
