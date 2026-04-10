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
            // Safely extract the error message from Zod issues
            const errorMsg = result.error.issues 
                ? result.error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(", ")
                : "Validation failed";
            throw new CustomError(errorMsg, 400);
        }

        // Update req objects with parsed/refined data
        if (result.data.body) req.body = result.data.body;
        if (result.data.params) Object.assign(req.params, result.data.params);
        // Express 5: req.query is read-only, so merge parsed values onto it
        if (result.data.query) {
            Object.keys(result.data.query).forEach(key => {
                req.query[key] = result.data.query[key];
            });
        }

        next();
    } catch (err) {
        next(err);
    }
};
