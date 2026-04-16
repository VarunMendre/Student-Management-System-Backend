import express from "express";
import scholarshipController from "../controllers/scholarshipController.js";
import { authorizeRoles } from "../middleware/authMiddleware.js";
import { scholarshipFormUpload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Student-side scholarship form submission
router.post(
    "/application/submit",
    authorizeRoles("student"),
    scholarshipFormUpload.single("form"),
    scholarshipController.submitApplication
);
router.get("/application/me", authorizeRoles("student"), scholarshipController.getMyApplication);

// Admin-side student applications + reconciliation
router.get("/applications", authorizeRoles("admin", "accountant", "principal"), scholarshipController.listApplications);
router.post("/reconcile", authorizeRoles("admin", "accountant", "principal"), scholarshipController.reconcile);

// Scholarship Configuration
router.get("/config/:courseId", scholarshipController.getConfig);
router.post("/config", scholarshipController.updateConfig);

// Scholarship Disbursal
router.post("/disburse", scholarshipController.disburse);

// Dashboard/Stats
router.get("/summary", scholarshipController.getSummary);

// Reverse Scholarship
router.delete("/reverse/:txnId", scholarshipController.reverse);

export default router;
