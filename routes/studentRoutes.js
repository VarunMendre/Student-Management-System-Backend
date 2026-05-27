import express from "express";
import { enrollStudent, listStudents, getStudent, getStudentMetadata, updateStudent, bulkImportStudents, getFeeLedgerReport } from "../controllers/studentController.js";
import { createPayment, getTransactions, getTransactionById, getFeeLedger, getStudentFeeOverview, getOverCollectionHistory } from "../controllers/paymentController.js";
import { authorizeRoles, authorizeStudentOrRoles, requireStudentOwnership } from "../middleware/authMiddleware.js";
import { validate } from "../validators/index.js";
import { studentSchemas } from "../validators/student/studentSchema.js";
import { paymentSchemas } from "../validators/payment/paymentSchema.js";
import { rateLimiters, throttlers } from "../config/securityConfig.js";

const router = express.Router();

// ========================
// Student Enrollment CRUD
// ========================
router.get("/meta/options", authorizeRoles("principal", "accountant", "admin"), rateLimiters.studentRead, validate(studentSchemas.metadata), getStudentMetadata);
router.post("/", authorizeRoles("principal", "accountant"), rateLimiters.studentWrite, validate(studentSchemas.enroll), enrollStudent);
router.post("/bulk-import", authorizeRoles("principal", "accountant"), rateLimiters.bulkImport, throttlers.bulkImport, validate(studentSchemas.bulkImport), bulkImportStudents);
router.get("/", authorizeRoles("principal", "accountant", "admin"), rateLimiters.studentRead, validate(studentSchemas.list), listStudents);
router.get("/reports/fee-ledger", authorizeRoles("principal", "accountant"), rateLimiters.transactionRead, getFeeLedgerReport);
router.get("/:id", authorizeStudentOrRoles("principal", "accountant", "admin"), rateLimiters.studentRead, validate(studentSchemas.byId), requireStudentOwnership("id"), getStudent);
router.patch("/:id", authorizeRoles("principal", "accountant"), rateLimiters.studentWrite, validate(studentSchemas.update), updateStudent);

// ========================
// Fee Payments (nested under students)
// ========================
router.post("/:id/payments", authorizeRoles("principal", "accountant"), rateLimiters.paymentWrite, validate(paymentSchemas.create), createPayment);

// ========================
// Transactions (nested under students)
// ========================
router.get("/:id/transactions", authorizeStudentOrRoles("principal", "accountant", "admin"), rateLimiters.transactionRead, validate(paymentSchemas.listTransactions), requireStudentOwnership("id"), getTransactions);
router.get("/:id/transactions/:txn_id", authorizeStudentOrRoles("principal", "accountant", "admin"), rateLimiters.transactionRead, validate(paymentSchemas.transactionById), requireStudentOwnership("id"), getTransactionById);

// ========================
// Fee Ledger (nested under students)
// ========================
router.get("/:id/fee-ledger", authorizeStudentOrRoles("principal", "accountant", "admin"), rateLimiters.transactionRead, validate(paymentSchemas.feeLedger), requireStudentOwnership("id"), getFeeLedger);
router.get("/:id/fee-overview", authorizeStudentOrRoles("principal", "accountant", "admin"), rateLimiters.transactionRead, validate(paymentSchemas.feeLedger), requireStudentOwnership("id"), getStudentFeeOverview);
router.get("/:id/over-collection", authorizeStudentOrRoles("principal", "accountant", "admin"), rateLimiters.transactionRead, validate(paymentSchemas.feeLedger), requireStudentOwnership("id"), getOverCollectionHistory);

export default router;
