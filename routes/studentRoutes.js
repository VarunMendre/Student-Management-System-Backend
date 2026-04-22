import express from "express";
import { enrollStudent, listStudents, getStudent, getStudentMetadata, updateStudent, bulkImportStudents, getFeeLedgerReport } from "../controllers/studentController.js";
import { createPayment, getTransactions, getTransactionById, getFeeLedger } from "../controllers/paymentController.js";
import { authorizeRoles, authorizeStudentOrRoles, requireStudentOwnership } from "../middleware/authMiddleware.js";
import { validate } from "../validators/index.js";
import { studentSchemas } from "../validators/student/studentSchema.js";
import { paymentSchemas } from "../validators/payment/paymentSchema.js";

const router = express.Router();

// ========================
// Student Enrollment CRUD
// ========================
router.get("/meta/options", authorizeRoles("principal", "accountant", "admin"), validate(studentSchemas.metadata), getStudentMetadata);
router.post("/", authorizeRoles("principal", "accountant"), validate(studentSchemas.enroll), enrollStudent);
router.post("/bulk-import", authorizeRoles("principal", "accountant"), validate(studentSchemas.bulkImport), bulkImportStudents);
router.get("/", authorizeRoles("principal", "accountant", "admin"), validate(studentSchemas.list), listStudents);
router.get("/reports/fee-ledger", authorizeRoles("principal", "accountant"), getFeeLedgerReport);
router.get("/:id", authorizeStudentOrRoles("principal", "accountant", "admin"), validate(studentSchemas.byId), requireStudentOwnership("id"), getStudent);
router.patch("/:id", authorizeRoles("principal", "accountant"), validate(studentSchemas.update), updateStudent);

// ========================
// Fee Payments (nested under students)
// ========================
router.post("/:id/payments", authorizeRoles("principal", "accountant"), validate(paymentSchemas.create), createPayment);

// ========================
// Transactions (nested under students)
// ========================
router.get("/:id/transactions", authorizeStudentOrRoles("principal", "accountant", "admin"), validate(paymentSchemas.listTransactions), requireStudentOwnership("id"), getTransactions);
router.get("/:id/transactions/:txn_id", authorizeStudentOrRoles("principal", "accountant", "admin"), validate(paymentSchemas.transactionById), requireStudentOwnership("id"), getTransactionById);

// ========================
// Fee Ledger (nested under students)
// ========================
router.get("/:id/fee-ledger", authorizeStudentOrRoles("principal", "accountant", "admin"), validate(paymentSchemas.feeLedger), requireStudentOwnership("id"), getFeeLedger);

export default router;
