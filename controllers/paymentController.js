import paymentService from "../services/paymentService.js";
import asyncHandler from "../utils/asyncHandler.js";
import { successResponse } from "../utils/customResponse.js";

export const createPayment = asyncHandler(async (req, res, next) => {
    const result = await paymentService.createPayment(parseInt(req.params.id), req.body);
    successResponse(res, result, "Payment recorded successfully", 201);
});

export const getTransactions = asyncHandler(async (req, res, next) => {
    const transactions = await paymentService.getTransactions(parseInt(req.params.id), req.query);
    successResponse(res, { data: transactions }, "Transactions fetched successfully");
});

export const getTransactionById = asyncHandler(async (req, res, next) => {
    const receipt = await paymentService.getTransactionById(parseInt(req.params.id), parseInt(req.params.txn_id));
    successResponse(res, { receipt }, "Transaction details fetched successfully");
});

export const getFeeLedger = asyncHandler(async (req, res, next) => {
    const ledger = await paymentService.getFeeLedger(parseInt(req.params.id));
    successResponse(res, ledger, "Fee ledger fetched successfully");
});
