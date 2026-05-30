import batchService from "../services/batchService.js";
import asyncHandler from "../utils/asyncHandler.js";
import { successResponse } from "../utils/customResponse.js";
import { CustomError, ErrorCodes } from "../utils/customError.js";

export const createBatch = asyncHandler(async (req, res) => {
    const { course_id, batch_name, admission_year, total_seats } = req.body;

    const newBatch = await batchService.createBatch({ course_id, batch_name, admission_year, total_seats });
    successResponse(res, newBatch, "Batch created successfully", 201);
});

export const saveFees = asyncHandler(async (req, res) => {
    const { batch_id } = req.params;
    const { components = [] } = req.body;

    const total = components.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

    await batchService.updateBatchFees(batch_id, components);
    successResponse(res, { total_fee: total }, "Batch fees updated successfully");
});

export const getBatchWithFees = asyncHandler(async (req, res) => {
    const { batch_id } = req.params;
    const batch = await batchService.getBatchWithFees(batch_id);

    if (!batch) {
        throw new CustomError({
            message: "Batch not found",
            statusCode: 404,
            code: ErrorCodes.NOT_FOUND
        });
    }

    successResponse(res, batch, "Batch with fees fetched successfully");
});

export const listBatches = asyncHandler(async (req, res) => {
    const { course_id } = req.query;
    const batches = await batchService.getAllBatches(course_id);
    successResponse(res, batches, "Batches fetched successfully");
});
