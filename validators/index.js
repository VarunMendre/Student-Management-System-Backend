import { CustomError } from "../utils/customError.js";
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
        const errorMsg = result.error.issues 
            ? result.error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(", ")
            : "Validation failed";
        throw new CustomError(errorMsg, 400);
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
