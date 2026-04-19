import express from "express";
import { listAllTransactions } from "../controllers/paymentController.js";
import { authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authorizeRoles("principal", "accountant", "admin"), listAllTransactions);

export default router;
