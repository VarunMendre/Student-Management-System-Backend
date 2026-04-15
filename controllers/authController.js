import bcrypt from "bcryptjs";
import userModel from "../models/userModel.js";
import { generateToken, verifyToken } from "../utils/jwtHelper.js";
import asyncHandler from "../utils/asyncHandler.js";
import { CustomError } from "../utils/customError.js";
import { successResponse } from "../utils/customResponse.js";

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

const issueTokens = async (user) => {
    const accessToken = generateToken(buildAuthPayload(user, "AccessToken"), ACCESS_EXPIRY);
    const refreshToken = generateToken(buildAuthPayload(user, "RefreshToken"), REFRESH_EXPIRY);

    await userModel.updateRefreshToken(user.id, refreshToken);

    return { accessToken, refreshToken };
};

export const login = asyncHandler(async (req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
        throw new CustomError("Email, password and role are required", 400);
    }

    const user = await userModel.findByEmail(email);

    if (!user || user.role !== role) {
        throw new CustomError("Invalid credentials", 401);
    }

    if (!user.is_active) {
        throw new CustomError("Your account has been deactivated", 403);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        throw new CustomError("Invalid credentials", 401);
    }

    const { accessToken, refreshToken } = await issueTokens(user);

    res.cookie("refreshToken", refreshToken, getRefreshCookieOptions());
    successResponse(res, {
        user: sanitizeUser(user),
        accessToken
    }, "Login successful");
});

export const refresh = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
        throw new CustomError("No refresh token provided", 401);
    }

    const decoded = verifyToken(refreshToken);
    if (!decoded || decoded.type !== "RefreshToken") {
        throw new CustomError("Invalid or expired refresh token", 401);
    }

    const user = await userModel.findByIdWithPassword(decoded.userId);
    if (!user || !user.is_active || user.refresh_token !== refreshToken) {
        throw new CustomError("Session expired. Please login again", 401);
    }

    const accessToken = generateToken(buildAuthPayload(user, "AccessToken"), ACCESS_EXPIRY);
    const newRefreshToken = generateToken(buildAuthPayload(user, "RefreshToken"), REFRESH_EXPIRY);

    await userModel.updateRefreshToken(user.id, newRefreshToken);
    res.cookie("refreshToken", newRefreshToken, getRefreshCookieOptions());

    successResponse(res, {
        accessToken,
        user: sanitizeUser(user)
    }, "Token refreshed successfully");
});

export const logout = asyncHandler(async (req, res) => {
    await userModel.updateRefreshToken(req.user.userId, null);
    res.clearCookie("refreshToken", getRefreshCookieOptions());
    successResponse(res, null, "Logged out successfully");
});

export const getMe = asyncHandler(async (req, res) => {
    const user = await userModel.findById(req.user.userId);

    if (!user) {
        throw new CustomError("User not found", 404);
    }

    successResponse(res, { user: sanitizeUser(user) }, "Current user fetched successfully");
});

export const resetPassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword) {
        throw new CustomError("New password is required", 400);
    }

    if (newPassword.length < 8) {
        throw new CustomError("New password must be at least 8 characters long", 400);
    }

    const user = await userModel.findByIdWithPassword(req.user.userId);
    if (!user) {
        throw new CustomError("User not found", 404);
    }

    if (user.is_password_changed) {
        if (!currentPassword) {
            throw new CustomError("Current password is required", 400);
        }

        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            throw new CustomError("Current password is incorrect", 400);
        }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const updatedUser = await userModel.updatePassword(user.id, hashedPassword);

    if (updatedUser?.student_id) {
        await userModel.updateStudentPasswordChangedStatus(updatedUser.student_id, true);
    }

    successResponse(res, {
        user: sanitizeUser(updatedUser)
    }, "Password reset successful");
});
