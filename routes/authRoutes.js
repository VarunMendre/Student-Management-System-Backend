import express from "express";
import { getMe, login, logout, refresh, resetPassword, updateMe } from "../controllers/authController.js";
import { verifyAccessToken } from "../middleware/authMiddleware.js";
import { rateLimiters, throttlers } from "../config/securityConfig.js";
import { validate } from "../validators/index.js";
import { authSchemas } from "../validators/auth/authSchema.js";
import { requireTrustedOrigin } from "../middleware/appSecurityMiddleware.js";

const router = express.Router();

router.post("/login", rateLimiters.authLogin, throttlers.authLogin, validate(authSchemas.login), login);
router.post("/refresh", requireTrustedOrigin, rateLimiters.authRefresh, throttlers.authRefresh, validate(authSchemas.refresh), refresh);
router.post("/logout", verifyAccessToken, rateLimiters.authLogout, requireTrustedOrigin, logout);
router.get("/me", verifyAccessToken, rateLimiters.authProfileRead, getMe);
router.patch("/me", verifyAccessToken, rateLimiters.authProfileUpdate, validate(authSchemas.updateMe), updateMe);
router.post("/reset-password", verifyAccessToken, rateLimiters.passwordReset, throttlers.passwordReset, requireTrustedOrigin, validate(authSchemas.resetPassword), resetPassword);

export default router;
