import { CustomError, ErrorCodes } from "../utils/customError.js";
import { logSecurityEvent } from "../utils/securityLogger.js";

const allowedOrigins = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

const isTrustedOrigin = (origin = "") => {
    const normalizedOrigin = String(origin || "").trim().replace(/\/+$/, "");
    return normalizedOrigin && allowedOrigins.includes(normalizedOrigin);
};

export const securityHeaders = (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    // This API is consumed cross-site (frontend and API are on different domains).
    // Setting CORP to same-site can cause browsers to block cross-site fetch/XHR in some cases.
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cache-Control", "no-store");

    next();
};

export const requireTrustedOrigin = (req, _res, next) => {
    if (allowedOrigins.length === 0) {
        return next();
    }

    const origin = req.get("origin");
    const referer = req.get("referer");

    if (origin && isTrustedOrigin(origin)) {
        return next();
    }

    if (referer) {
        try {
            const refererOrigin = new URL(referer).origin;
            if (isTrustedOrigin(refererOrigin)) {
                return next();
            }
        } catch {
            // fall through to rejection
        }
    }

    logSecurityEvent("untrusted_origin_blocked", req, {
        origin: origin || null,
        referer: referer || null
    });

    return next(new CustomError({
        message: "Untrusted request origin",
        statusCode: 403,
        code: ErrorCodes.FORBIDDEN
    }));
};
