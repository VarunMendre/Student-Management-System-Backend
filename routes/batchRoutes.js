import express from "express";
import { createBatch, saveFees, getBatchWithFees, listBatches } from "../controllers/batchController.js";
import { authorizeRoles } from "../middleware/authMiddleware.js";
import { validate } from "../validators/index.js";
import { batchSchemas } from "../validators/batch/batchSchema.js";

const router = express.Router();

router.post("/", authorizeRoles("principal", "accountant"), validate(batchSchemas.create), createBatch);
router.get("/", authorizeRoles("principal", "accountant", "admin"), listBatches);
router.get("/:batch_id", authorizeRoles("principal", "accountant", "admin"), validate(batchSchemas.byId), getBatchWithFees);
router.put("/:batch_id/fees", authorizeRoles("principal", "accountant"), validate(batchSchemas.saveFees), saveFees);

export default router;
