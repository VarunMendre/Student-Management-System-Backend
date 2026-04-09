import express from "express";
import { createBatch, saveFees, getBatchWithFees } from "../controllers/batchController.js";

const router = express.Router();

router.post("/", createBatch);           // Create Batch (incl. seats)
router.get("/:batch_id", getBatchWithFees);      // Get Details + Total Fee
router.put("/:batch_id/fees", saveFees); // Atomic Fee Update

export default router;