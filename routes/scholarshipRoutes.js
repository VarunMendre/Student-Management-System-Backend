import express from "express";
import scholarshipController from "../controllers/scholarshipController.js";

const router = express.Router();

// 📂 Scholarship Configuration
router.get("/config/:courseId", scholarshipController.getConfig);
router.post("/config", scholarshipController.updateConfig);

// 💸 Scholarship Disbursal
router.post("/disburse", scholarshipController.disburse);

// 📊 Dashboard/Stats
router.get("/summary", scholarshipController.getSummary);

// ⏪ Reverse Scholarship
router.delete("/reverse/:txnId", scholarshipController.reverse);

export default router;
