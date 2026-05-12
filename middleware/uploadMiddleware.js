import multer from "multer";

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
    storage: multer.memoryStorage(),
    fileFilter,
    limits: {
        fileSize: 8 * 1024 * 1024 // 8MB
    }
});
