import { verifyToken } from "../utils/jwtHelper.js";
import { CustomError, ErrorCodes } from "../utils/customError.js";
import { logSecurityEvent } from "../utils/securityLogger.js";

const ensureAuthenticatedUser = (req) => {
    if (!req.user) {
        throw new CustomError({
            message: "Unauthorized",
            statusCode: 401,
            code: ErrorCodes.UNAUTHORIZED
        });
    }
};

const parsePositiveInteger = (value, fieldName = "id") => {
    const parsedValue = Number(value);

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        throw new CustomError({
            message: `Invalid ${fieldName}`,
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }

    return parsedValue;
};

export const verifyAccessToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
        logSecurityEvent("missing_access_token", req);
        throw new CustomError({
            message: "Unauthorized",
            statusCode: 401,
            code: ErrorCodes.UNAUTHORIZED
        });
    }

    const token = authHeader.split("Bearer ")[1];
    const decoded = verifyToken(token);

    if (!decoded || decoded.type !== "AccessToken") {
        logSecurityEvent("invalid_access_token", req);
        throw new CustomError({
            message: "Invalid or expired access token",
            statusCode: 401,
            code: ErrorCodes.UNAUTHORIZED
        });
    }

    req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        student_id: decoded.student_id || null
    };

    next();
};

export const authorizeRoles = (...roles) => (req, res, next) => {
    ensureAuthenticatedUser(req);

    if (!roles.includes(req.user.role)) {
        logSecurityEvent("forbidden_role_access", req, {
            requiredRoles: roles
        });
        throw new CustomError({
            message: "Forbidden",
            statusCode: 403,
            code: ErrorCodes.FORBIDDEN
        });
    }

    next();
};

export const authorizeStudentOrRoles = (...roles) => (req, res, next) => {
    ensureAuthenticatedUser(req);

    if (req.user.role === "student" || roles.includes(req.user.role)) {
        return next();
    }

    logSecurityEvent("forbidden_role_access", req, {
        requiredRoles: roles,
        allowStudent: true
    });
    throw new CustomError({
        message: "Forbidden",
        statusCode: 403,
        code: ErrorCodes.FORBIDDEN
    });
};

export const requireStudentOwnership = (paramName = "id") => (req, res, next) => {
    ensureAuthenticatedUser(req);

    if (req.user.role !== "student") {
        return next();
    }

    if (!req.user.student_id) {
        logSecurityEvent("student_ownership_missing_mapping", req, {
            paramName
        });
        throw new CustomError({
            message: "Forbidden",
            statusCode: 403,
            code: ErrorCodes.FORBIDDEN
        });
    }

    const requestedStudentId = parsePositiveInteger(req.params[paramName], "student id");

    if (requestedStudentId !== Number(req.user.student_id)) {
        logSecurityEvent("student_ownership_violation", req, {
            paramName,
            requestedStudentId
        });
        throw new CustomError({
            message: "Forbidden",
            statusCode: 403,
            code: ErrorCodes.FORBIDDEN
        });
    }

    next();
};
