export const ErrorCodes = {
    NOT_FOUND: "NOT_FOUND",
    DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    BATCH_FULL: "BATCH_FULL",
    OVERPAYMENT: "OVERPAYMENT",
    DATABASE_ERROR: "DATABASE_ERROR"
};

export class CustomError extends Error {
    constructor(message, statusCode = 500, errorCode = null, details = null) {
        super(message);

        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.status = statusCode;
        this.errorCode = errorCode;
        this.isOperational = true;
        if (details) this.details = details;

        Error.captureStackTrace(this, this.constructor);
    }
}
