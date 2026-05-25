import express from "express";
import scholarshipController from "../controllers/scholarshipController.js";
import { authorizeRoles, authorizeStudentOrRoles } from "../middleware/authMiddleware.js";
import { scholarshipFormUpload } from "../middleware/uploadMiddleware.js";
import { rateLimiters, throttlers } from "../config/securityConfig.js";
import { validate } from "../validators/index.js";
import { scholarshipSchemas } from "../validators/scholarship/scholarshipSchema.js";

const router = express.Router();

// Student-side scholarship form submission
router.post(
    "/application/submit",
    authorizeRoles("student"),
    rateLimiters.scholarshipUpload,
    throttlers.scholarshipUpload,
    scholarshipFormUpload.single("form"),
    validate(scholarshipSchemas.submitApplication),
    scholarshipController.submitApplication
);
router.get("/application/me", authorizeRoles("student"), rateLimiters.scholarshipRead, scholarshipController.getMyApplication);
router.get("/applications/:id/form-url", authorizeStudentOrRoles("admin", "accountant", "principal"), rateLimiters.scholarshipRead, validate(scholarshipSchemas.getApplicationUrl), scholarshipController.getApplicationFormUrl);

// Admin-side student applications + reconciliation
router.get("/applications", authorizeRoles("admin", "accountant", "principal"), rateLimiters.scholarshipRead, scholarshipController.listApplications);
router.post("/reconcile", authorizeRoles("admin", "principal"), rateLimiters.scholarshipWrite, throttlers.scholarshipWrite, validate(scholarshipSchemas.reconcile), scholarshipController.reconcile);

// Scholarship Configuration
router.get("/config/:courseId", authorizeRoles("admin", "accountant", "principal"), rateLimiters.scholarshipRead, validate(scholarshipSchemas.getConfig), scholarshipController.getConfig);
router.post("/config", authorizeRoles("admin", "principal"), rateLimiters.scholarshipWrite, throttlers.scholarshipWrite, validate(scholarshipSchemas.updateConfig), scholarshipController.updateConfig);

// Scholarship Disbursal
router.post("/disburse", authorizeRoles("admin", "principal"), rateLimiters.scholarshipWrite, throttlers.scholarshipWrite, validate(scholarshipSchemas.disburse), scholarshipController.disburse);

// Dashboard/Stats
router.get("/summary", authorizeRoles("admin", "principal"), rateLimiters.scholarshipRead, scholarshipController.getSummary);

// Reverse Scholarship
router.delete("/reverse/:txnId", authorizeRoles("admin", "principal"), rateLimiters.scholarshipWrite, throttlers.scholarshipWrite, validate(scholarshipSchemas.reverse), scholarshipController.reverse);

export default router;
