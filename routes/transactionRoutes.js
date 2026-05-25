import express from "express";
import { listAllTransactions } from "../controllers/paymentController.js";
import { authorizeRoles } from "../middleware/authMiddleware.js";
import { rateLimiters } from "../config/securityConfig.js";
import { validate } from "../validators/index.js";
import { transactionSchemas } from "../validators/transaction/transactionSchema.js";

const router = express.Router();

router.get("/", authorizeRoles("principal", "accountant", "admin"), rateLimiters.transactionRead, validate(transactionSchemas.listAll), listAllTransactions);

export default router;
