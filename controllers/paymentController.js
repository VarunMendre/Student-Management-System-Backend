import paymentService from "../services/paymentService.js";
import asyncHandler from "../utils/asyncHandler.js";
import { successResponse } from "../utils/customResponse.js";

export const createPayment = asyncHandler(async (req, res) => {
    const result = await paymentService.createPayment(parseInt(req.params.id), req.body);
    successResponse(res, result, "Payment recorded successfully", 201);
});

export const getTransactions = asyncHandler(async (req, res) => {
    const transactions = await paymentService.getTransactions(parseInt(req.params.id), req.query);
    successResponse(res, { data: transactions }, "Transactions fetched successfully");
});

export const getTransactionById = asyncHandler(async (req, res) => {
    const receipt = await paymentService.getTransactionById(parseInt(req.params.id), parseInt(req.params.txn_id));
    successResponse(res, { receipt }, "Transaction details fetched successfully");
});

export const getFeeLedger = asyncHandler(async (req, res) => {
    const ledger = await paymentService.getFeeLedger(parseInt(req.params.id));
    successResponse(res, ledger, "Fee ledger fetched successfully");
});

export const listAllTransactions = asyncHandler(async (req, res) => {
    const { transactions, total } = await paymentService.getAllTransactions(req.query);
    successResponse(res, { data: transactions, total }, "All transactions fetched successfully");
});

export const getStudentFeeOverview = asyncHandler(async (req, res) => {
    const result = await paymentService.getStudentFeeOverview(parseInt(req.params.id), req.query.academic_year_num);
    successResponse(res, result, "Student fee overview fetched successfully");
});

export const getOverCollectionHistory = asyncHandler(async (req, res) => {
    const result = await paymentService.getOverCollectionHistory(parseInt(req.params.id));
    successResponse(res, { data: result }, "Over-collection history fetched successfully");
});
