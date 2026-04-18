import bcrypt from "bcryptjs";
import userModel from "../models/userModel.js";
import { generateToken, verifyToken } from "../utils/jwtHelper.js";
import { CustomError, ErrorCodes } from "../utils/customError.js";

const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "15m";
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || "7d";
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const getRefreshCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFRESH_COOKIE_MAX_AGE
});

const buildAuthPayload = (user, tokenType) => ({
    userId: user.id,
    email: user.email,
    role: user.role,
    type: tokenType
});

const sanitizeUser = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    contact_number: user.contact_number,
    role: user.role,
    student_id: user.student_id,
    is_active: user.is_active,
    is_password_changed: user.is_password_changed
});

const createSessionTokens = async (user) => {
    const accessToken = generateToken(buildAuthPayload(user, "AccessToken"), ACCESS_EXPIRY);
    const refreshToken = generateToken(buildAuthPayload(user, "RefreshToken"), REFRESH_EXPIRY);

    await userModel.updateRefreshToken(user.id, refreshToken);

    return { accessToken, refreshToken };
};

const ensureUserExists = async (userId) => {
    const user = await userModel.findByIdWithPassword(userId);

    if (!user) {
        throw new CustomError({
            message: "User not found",
            statusCode: 404,
            code: ErrorCodes.NOT_FOUND
        });
    }

    return user;
};

const loginUser = async ({ email, password, role }) => {
    if (!email || !password || !role) {
        throw new CustomError({
            message: "Email, password and role are required",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }

    const user = await userModel.findByEmail(email);

    if (!user || user.role !== role) {
        throw new CustomError({
            message: "Invalid credentials",
            statusCode: 401,
            code: ErrorCodes.UNAUTHORIZED
        });
    }

    if (!user.is_active) {
        throw new CustomError({
            message: "Your account has been deactivated",
            statusCode: 403,
            code: ErrorCodes.FORBIDDEN
        });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
        throw new CustomError({
            message: "Invalid credentials",
            statusCode: 401,
            code: ErrorCodes.UNAUTHORIZED
        });
    }

    const { accessToken, refreshToken } = await createSessionTokens(user);

    return {
        accessToken,
        refreshToken,
        user: sanitizeUser(user)
    };
};

const refreshSession = async (refreshToken) => {
    if (!refreshToken) {
        throw new CustomError({
            message: "No refresh token provided",
            statusCode: 401,
            code: ErrorCodes.UNAUTHORIZED
        });
    }

    const decoded = verifyToken(refreshToken);

    if (!decoded || decoded.type !== "RefreshToken") {
        throw new CustomError({
            message: "Invalid or expired refresh token",
            statusCode: 401,
            code: ErrorCodes.UNAUTHORIZED
        });
    }

    const user = await ensureUserExists(decoded.userId);

    if (!user.is_active || user.refresh_token !== refreshToken) {
        throw new CustomError({
            message: "Session expired. Please login again",
            statusCode: 401,
            code: ErrorCodes.UNAUTHORIZED
        });
    }

    const { accessToken, refreshToken: nextRefreshToken } = await createSessionTokens(user);

    return {
        accessToken,
        refreshToken: nextRefreshToken,
        user: sanitizeUser(user)
    };
};

const logoutUser = async (userId) => {
    await userModel.updateRefreshToken(userId, null);
};

const getCurrentUser = async (userId) => {
    const user = await userModel.findById(userId);

    if (!user) {
        throw new CustomError({
            message: "User not found",
            statusCode: 404,
            code: ErrorCodes.NOT_FOUND
        });
    }

    return sanitizeUser(user);
};

const resetUserPassword = async (userId, { currentPassword, newPassword }) => {
    if (!newPassword) {
        throw new CustomError({
            message: "New password is required",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }

    if (newPassword.length < 8) {
        throw new CustomError({
            message: "New password must be at least 8 characters long",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }

    const user = await ensureUserExists(userId);

    if (user.is_password_changed) {
        if (!currentPassword) {
            throw new CustomError({
                message: "Current password is required",
                statusCode: 400,
                code: ErrorCodes.VALIDATION_ERROR
            });
        }

        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

        if (!isCurrentPasswordValid) {
            throw new CustomError({
                message: "Current password is incorrect",
                statusCode: 400,
                code: ErrorCodes.VALIDATION_ERROR
            });
        }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const updatedUser = await userModel.updatePassword(user.id, hashedPassword);

    if (updatedUser?.student_id) {
        await userModel.updateStudentPasswordChangedStatus(updatedUser.student_id, true);
    }

    return sanitizeUser(updatedUser);
};

export default {
    getRefreshCookieOptions,
    loginUser,
    refreshSession,
    logoutUser,
    getCurrentUser,
    resetUserPassword
};
