export const ErrorCodes = {
    NOT_FOUND: "NOT_FOUND",
    DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    BATCH_FULL: "BATCH_FULL",
    OVERPAYMENT: "OVERPAYMENT",
    DATABASE_ERROR: "DATABASE_ERROR",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    CONFLICT: "CONFLICT"
};

export class CustomError extends Error {
    constructor({
        message = "Internal Server Error",
        statusCode = 500,
        code = ErrorCodes.INTERNAL_ERROR,
        details = null,
        fieldErrors = null,
        isOperational = true,
        cause = null,
        timestamp = new Date().toISOString()
    } = {}) {
        super(message);

        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.errorCode = code;
        this.isOperational = isOperational;
        this.timestamp = timestamp;
        if (cause) this.cause = cause;
        if (details) this.details = details;
        if (fieldErrors) this.fieldErrors = fieldErrors;

        Error.captureStackTrace?.(this, this.constructor);
    }
}
