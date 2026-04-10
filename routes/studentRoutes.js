import express from "express";
import { enrollStudent, listStudents, getStudent, updateStudent } from "../controllers/studentController.js";
import { createPayment, getTransactions, getTransactionById, getFeeLedger } from "../controllers/paymentController.js";
import { validate } from "../validators/index.js";
import { studentSchemas } from "../validators/student/studentSchema.js";
import { paymentSchemas } from "../validators/payment/paymentSchema.js";

const router = express.Router();

// ========================
// Student Enrollment CRUD
// ========================
router.post("/", validate(studentSchemas.enroll), enrollStudent);
router.get("/", validate(studentSchemas.list), listStudents);
router.get("/:id", validate(studentSchemas.byId), getStudent);
router.patch("/:id", validate(studentSchemas.update), updateStudent);

// ========================
// Fee Payments (nested under students)
// ========================
router.post("/:id/payments", validate(paymentSchemas.create), createPayment);

// ========================
// Transactions (nested under students)
// ========================
router.get("/:id/transactions", validate(paymentSchemas.listTransactions), getTransactions);
router.get("/:id/transactions/:txn_id", validate(paymentSchemas.transactionById), getTransactionById);

// ========================
// Fee Ledger (nested under students)
// ========================
router.get("/:id/fee-ledger", validate(paymentSchemas.feeLedger), getFeeLedger);

export default router;
