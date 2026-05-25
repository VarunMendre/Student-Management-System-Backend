import authService from "../services/authService.js";
import asyncHandler from "../utils/asyncHandler.js";
import { successResponse } from "../utils/customResponse.js";

export const login = asyncHandler(async (req, res) => {
    const { accessToken, refreshToken, user } = await authService.loginUser(req.body);

    res.cookie("refreshToken", refreshToken, authService.getRefreshCookieOptions());
    successResponse(res, {
        user,
        accessToken,
        refreshToken
    }, "Login successful");
});

export const refresh = asyncHandler(async (req, res) => {
    // Accept refresh token from request body (cross-origin) or cookie (same-origin fallback)
    const incomingRefreshToken = req.body?.refreshToken || req.cookies?.refreshToken;

    const { accessToken, refreshToken, user } = await authService.refreshSession(incomingRefreshToken);

    res.cookie("refreshToken", refreshToken, authService.getRefreshCookieOptions());

    successResponse(res, {
        accessToken,
        refreshToken,
        user
    }, "Token refreshed successfully");
});

export const logout = asyncHandler(async (req, res) => {
    await authService.logoutUser(req.user.userId);
    res.clearCookie("refreshToken", authService.getRefreshCookieOptions());
    successResponse(res, null, "Logged out successfully");
});

export const getMe = asyncHandler(async (req, res) => {
    const user = await authService.getCurrentUser(req.user.userId);
    successResponse(res, { user }, "Current user fetched successfully");
});

export const updateMe = asyncHandler(async (req, res) => {
    const user = await authService.updateCurrentUser(req.user.userId, req.body);
    successResponse(res, { user }, "Profile updated successfully");
});

export const resetPassword = asyncHandler(async (req, res) => {
    const user = await authService.resetUserPassword(req.user.userId, req.body);
    successResponse(res, { user }, "Password reset successful");
});
