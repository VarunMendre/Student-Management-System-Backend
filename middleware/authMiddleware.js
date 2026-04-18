import { verifyToken } from "../utils/jwtHelper.js";
import { CustomError, ErrorCodes } from "../utils/customError.js";

export const verifyAccessToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
        throw new CustomError({
            message: "Unauthorized",
            statusCode: 401,
            code: ErrorCodes.UNAUTHORIZED
        });
    }

    const token = authHeader.split("Bearer ")[1];
    const decoded = verifyToken(token);

    if (!decoded || decoded.type !== "AccessToken") {
        throw new CustomError({
            message: "Invalid or expired access token",
            statusCode: 401,
            code: ErrorCodes.UNAUTHORIZED
        });
    }

    req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
    };

    next();
};

export const authorizeRoles = (...roles) => (req, res, next) => {
    if (!req.user) {
        throw new CustomError({
            message: "Unauthorized",
            statusCode: 401,
            code: ErrorCodes.UNAUTHORIZED
        });
    }

    if (!roles.includes(req.user.role)) {
        throw new CustomError({
            message: "Forbidden",
            statusCode: 403,
            code: ErrorCodes.FORBIDDEN
        });
    }

    next();
};
