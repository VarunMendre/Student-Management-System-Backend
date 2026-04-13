import express from "express";
import { createBatch, saveFees, getBatchWithFees, listBatches } from "../controllers/batchController.js";
import { validate } from "../validators/index.js";
import { batchSchemas } from "../validators/batch/batchSchema.js";

const router = express.Router();

router.post("/", validate(batchSchemas.create), createBatch);           
router.get("/", listBatches);
router.get("/:batch_id", validate(batchSchemas.byId), getBatchWithFees);      
router.put("/:batch_id/fees", validate(batchSchemas.saveFees), saveFees); 

export default router;