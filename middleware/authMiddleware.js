import { verifyToken } from "../utils/jwtHelper.js";

export const verifyAccessToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split("Bearer ")[1];
    const decoded = verifyToken(token);

    if (!decoded || decoded.type !== "AccessToken") {
        return res.status(401).json({ message: "Invalid or expired access token" });
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
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (!roles.includes(req.user.role)) {
        return res.status(403).json({ message: "Forbidden" });
    }

    next();
};
