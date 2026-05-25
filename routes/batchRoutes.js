import express from "express";
import { createBatch, saveFees, getBatchWithFees, listBatches } from "../controllers/batchController.js";
import { authorizeRoles } from "../middleware/authMiddleware.js";
import { validate } from "../validators/index.js";
import { batchSchemas } from "../validators/batch/batchSchema.js";
import { rateLimiters } from "../config/securityConfig.js";

const router = express.Router();

router.post("/", authorizeRoles("principal", "accountant"), rateLimiters.catalogWrite, validate(batchSchemas.create), createBatch);
router.get("/", authorizeRoles("principal", "accountant", "admin", "student"), rateLimiters.catalogRead, listBatches);
router.get("/:batch_id", authorizeRoles("principal", "accountant", "admin", "student"), rateLimiters.catalogRead, validate(batchSchemas.byId), getBatchWithFees);
router.put("/:batch_id/fees", authorizeRoles("principal", "accountant"), rateLimiters.catalogWrite, validate(batchSchemas.saveFees), saveFees);

export default router;
