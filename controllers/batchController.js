import batchService from "../services/batchService.js"; // Added .js
import asyncHandler from "../utils/asyncHandler.js"; // Added .js
import { successResponse } from "../utils/customResponse.js"; // Added Missing Import
import { CustomError } from "../utils/customError.js"; // Added Missing Import

export const createBatch = asyncHandler(async (req, res, next) => {
    const { course_id, batch_name, admission_year, total_seats } = req.body;

    // Fixed validation (total_seats can be 0)
    if (!course_id || !batch_name || !admission_year || total_seats === undefined) {
        throw new CustomError("All fields are required", 400);
    }

    if (typeof admission_year !== "number" || admission_year < 1000 || admission_year > 9999) {
        throw new CustomError("Admission year must be a valid 4-digit year", 400);
    }

    if (total_seats < 0) {
        throw new CustomError("Total seats must be a non-negative number", 400);
    }

    const newBatch = await batchService.createBatch({ course_id, batch_name, admission_year, total_seats });
    successResponse(res, newBatch, "Batch created successfully", 201);
});

export const saveFees = asyncHandler(async (req, res, next) => {
    const { batch_id } = req.params; // Get from params as per route definition
    const { components } = req.body;

    if (!batch_id || !components || !Array.isArray(components) || components.length === 0) {
        throw new CustomError("Batch ID and fee components are required", 400);
    }

    const total = components.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

    if (total <= 0) {
        throw new CustomError("Total fee must be greater than 0", 400);
    }

    await batchService.updateBatchFees(batch_id, components);
    successResponse(res, { total_fee: total }, "Batch fees updated successfully");
});

export const getBatchWithFees = asyncHandler(async (req, res, next) => {
    const { batch_id } = req.params;

    const batch = await batchService.getBatchWithFees(batch_id);

    // Added 404 check
    if (!batch) {
        throw new CustomError("Batch not found", 404);
    }

    successResponse(res, batch, "Batch with fees fetched successfully");
});
