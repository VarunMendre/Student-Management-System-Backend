import express from "express";
import { listAllTransactions } from "../controllers/paymentController.js";

const router = express.Router();

router.get("/", listAllTransactions);

export default router;
