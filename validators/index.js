import { CustomError, ErrorCodes } from "../utils/customError.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * Common entry point for validation middleware
 * Uses asyncHandler to avoid internal try-catch
 */
export const validate = (schema) => asyncHandler(async (req, res, next) => {
    const result = schema.safeParse({
        body: req.body,
        params: req.params,
        query: req.query
    });

    if (!result.success) {
        const issues = result.error.issues || [];
        throw new CustomError({
            message: "Validation failed",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR,
            details: { issues }
        });
    }

    if (result.data.body) req.body = result.data.body;
    if (result.data.params) Object.assign(req.params, result.data.params);
    if (result.data.query) {
        Object.keys(result.data.query).forEach(key => {
            req.query[key] = result.data.query[key];
        });
    }

    next();
});
