import { CustomError } from "../utils/customError.js";

/**
 * Common entry point for validation
 * @param {import('zod').ZodSchema} schema 
 */
export const validate = (schema) => (req, res, next) => {
    try {
        // Validate request data (merging body and params if needed for complete checks)
        // Usually, we validate body, params, and query separately or as a combined object
        const result = schema.safeParse({
            body: req.body,
            params: req.params,
            query: req.query
        });

        if (!result.success) {
            // Extract the first error message for simplicity, or join multiple
            const errorMsg = result.error.errors.map(err => err.message).join(", ");
            throw new CustomError(errorMsg, 400);
        }

        // Update req objects with parsed/refined data
        req.body = result.data.body;
        req.params = result.data.params;
        req.query = result.data.query;

        next();
    } catch (err) {
        next(err);
    }
};
