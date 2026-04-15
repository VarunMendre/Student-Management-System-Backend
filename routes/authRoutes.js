import express from "express";
import { getMe, login, logout, refresh, resetPassword } from "../controllers/authController.js";
import { verifyAccessToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", verifyAccessToken, logout);
router.get("/me", verifyAccessToken, getMe);
router.post("/reset-password", verifyAccessToken, resetPassword);

export default router;
