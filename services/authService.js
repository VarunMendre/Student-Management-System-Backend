import bcrypt from "bcryptjs";
import userModel from "../models/userModel.js";
import studentModel from "../models/studentModel.js";
import { generateToken, verifyToken } from "../utils/jwtHelper.js";
import { CustomError, ErrorCodes } from "../utils/customError.js";
import { normalizeEmail } from "../utils/studentOptions.js";

const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "15m";
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || "7d";
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const frontendOrigins = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
const IS_HTTPS_FRONTEND = frontendOrigins.some((origin) => origin.startsWith("https://"));
const requestedSameSite = String(process.env.COOKIE_SAME_SITE || "").trim().toLowerCase();
const COOKIE_SAME_SITE = ["strict", "lax", "none"].includes(requestedSameSite)
    ? requestedSameSite
    : (IS_HTTPS_FRONTEND ? "none" : "lax");
const COOKIE_SECURE = process.env.COOKIE_SECURE
    ? String(process.env.COOKIE_SECURE).trim().toLowerCase() === "true"
    : (COOKIE_SAME_SITE === "none" || IS_HTTPS_FRONTEND);
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const COOKIE_PARTITIONED = process.env.COOKIE_PARTITIONED
    ? String(process.env.COOKIE_PARTITIONED).trim().toLowerCase() === "true"
    : COOKIE_SAME_SITE === "none";

const getRefreshCookieOptions = () => {
    const options = {
        httpOnly: true,
        secure: COOKIE_SAME_SITE === "none" ? true : COOKIE_SECURE,
        sameSite: COOKIE_SAME_SITE,
        maxAge: REFRESH_COOKIE_MAX_AGE,
        path: "/",
        priority: "high"
    };

    // Cross-site auth cookies are increasingly restricted by browsers.
    // Partitioned cookies improve compatibility when frontend and API live on different sites.
    if (COOKIE_PARTITIONED && COOKIE_SAME_SITE === "none") {
        options.partitioned = true;
    }

    if (COOKIE_DOMAIN) {
        options.domain = COOKIE_DOMAIN;
    }

    return options;
};

const buildAuthPayload = (user, tokenType) => ({
    userId: user.id,
    email: user.email,
    role: user.role,
    student_id: user.student_id || null,
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

    const normalizedEmail = normalizeEmail(email);
    const user = await userModel.findByEmail(normalizedEmail);

    if (!user) {
        throw new CustomError({
            message: "Invalid email, password, or role",
            statusCode: 401,
            code: ErrorCodes.UNAUTHORIZED
        });
    }

    if (user.role !== role) {
        throw new CustomError({
            message: "Invalid email, password, or role",
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
            message: "Invalid email, password, or role",
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

const updateCurrentUser = async (userId, { name, email, contact_number }) => {
    const trimmedName = String(name || "").trim();
    const trimmedEmail = String(email || "").trim().toLowerCase();
    const trimmedContactNumber = String(contact_number || "").trim();

    if (!trimmedName || !trimmedEmail || !trimmedContactNumber) {
        throw new CustomError({
            message: "Name, email and contact number are required",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
        throw new CustomError({
            message: "Enter a valid email address",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }

    const phoneRegex = /^[0-9+\-\s]{10,15}$/;
    if (!phoneRegex.test(trimmedContactNumber)) {
        throw new CustomError({
            message: "Enter a valid contact number",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }

    const user = await userModel.findById(userId);

    if (!user) {
        throw new CustomError({
            message: "User not found",
            statusCode: 404,
            code: ErrorCodes.NOT_FOUND
        });
    }

    const existingUser = await userModel.findByEmailExcludingId(trimmedEmail, userId);
    if (existingUser) {
        throw new CustomError({
            message: "Email is already in use",
            statusCode: 409,
            code: ErrorCodes.CONFLICT
        });
    }

    const updatedUser = await userModel.updateProfile(userId, {
        name: trimmedName,
        email: trimmedEmail,
        contact_number: trimmedContactNumber
    });

    // If user is a student, sync with academic students table
    if (updatedUser.student_id) {
        try {
            await studentModel.syncStudentProfile(updatedUser.student_id, {
                full_name: trimmedName,
                email: trimmedEmail,
                mobile_number: trimmedContactNumber
            });
        } catch (syncError) {
            console.error(`Failed to sync student ${updatedUser.student_id}:`, syncError);
            // We don't throw here to avoid failing the user profile update itself,
            // but in a production app we might want more robust sync or queueing.
        }
    }

    return sanitizeUser(updatedUser);
};

const resetUserPassword = async (userId, { currentPassword, newPassword }) => {
    if (!newPassword) {
        throw new CustomError({
            message: "New password is required",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }

    if (newPassword.length < 12) {
        throw new CustomError({
            message: "New password must be at least 12 characters long",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
        throw new CustomError({
            message: "New password must include uppercase, lowercase, number, and special character",
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
    updateCurrentUser,
    resetUserPassword
};
