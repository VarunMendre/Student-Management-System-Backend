import { CustomError, ErrorCodes } from "../utils/customError.js";
import { logSecurityEvent } from "../utils/securityLogger.js";

const DEFAULT_KEY_PREFIX = "security";

const stores = {
    rateLimit: new Map(),
    throttle: new Map()
};

const pruneState = {
    rateLimit: 0,
    throttle: 0
};

const now = () => Date.now();

const getClientIp = (req) => {
    if (Array.isArray(req.ips) && req.ips.length > 0) {
        return req.ips[0];
    }

    return req.ip || req.socket?.remoteAddress || "unknown";
};

const normalizePath = (req) => {
    const baseUrl = req.baseUrl || "";
    const routePath = req.route?.path;

    if (typeof routePath === "string") {
        return `${baseUrl}${routePath}`;
    }

    return req.originalUrl?.split("?")[0] || req.path || req.url || "/";
};

const defaultKeyGenerator = (scope = "ip") => (req) => {
    const routeKey = normalizePath(req);

    if (scope === "user" && req.user?.userId) {
        return `${req.user.userId}:${routeKey}`;
    }

    if (scope === "user-or-ip" && req.user?.userId) {
        return `${req.user.userId}:${routeKey}`;
    }

    return `${getClientIp(req)}:${routeKey}`;
};

const pruneExpiredEntries = (store, maxAgeMs) => {
    const current = now();

    for (const [key, value] of store.entries()) {
        const lastSeenAt = value.lastRequestAt || value.windowStart || 0;

        if (current - lastSeenAt > maxAgeMs) {
            store.delete(key);
        }
    }
};

const pruneOccasionally = (storeName, maxAgeMs) => {
    const current = now();

    if (current - pruneState[storeName] < 60 * 1000) {
        return;
    }

    pruneState[storeName] = current;
    pruneExpiredEntries(stores[storeName], maxAgeMs);
};

const buildRateLimitError = ({ message, retryAfterSeconds, limit, windowMs }) => new CustomError({
    message,
    statusCode: 429,
    code: ErrorCodes.TOO_MANY_REQUESTS || "TOO_MANY_REQUESTS",
    details: {
        retryAfterSeconds,
        limit,
        windowMs
    }
});

const buildRateLimitHeaders = (res, { limit, remaining, resetTime }) => {
    res.setHeader("RateLimit-Policy", `${limit};w=${Math.ceil(resetTime / 1000)}`);
    res.setHeader("RateLimit-Limit", limit);
    res.setHeader("RateLimit-Remaining", Math.max(remaining, 0));
    res.setHeader("RateLimit-Reset", Math.max(Math.ceil(resetTime / 1000), 0));
};

export const createRateLimiter = ({
    windowMs = 15 * 60 * 1000,
    limit = 100,
    message = "Too many requests, please try again later.",
    keyPrefix = DEFAULT_KEY_PREFIX,
    keyGenerator = defaultKeyGenerator("ip")
} = {}) => {
    return (req, res, next) => {
        pruneOccasionally("rateLimit", windowMs * 2);

        const current = now();
        const key = `${keyPrefix}:${keyGenerator(req)}`;
        const existing = stores.rateLimit.get(key);

        if (!existing || current >= existing.resetAt) {
            const entry = {
                count: 1,
                windowStart: current,
                resetAt: current + windowMs
            };

            stores.rateLimit.set(key, entry);
            buildRateLimitHeaders(res, {
                limit,
                remaining: limit - entry.count,
                resetTime: entry.resetAt - current
            });
            return next();
        }

        existing.count += 1;

        buildRateLimitHeaders(res, {
            limit,
            remaining: limit - existing.count,
            resetTime: existing.resetAt - current
        });

        if (existing.count > limit) {
            const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - current) / 1000));
            res.setHeader("Retry-After", retryAfterSeconds);
            logSecurityEvent("rate_limit_exceeded", req, {
                keyPrefix,
                limit,
                windowMs,
                retryAfterSeconds
            });
            return next(buildRateLimitError({ message, retryAfterSeconds, limit, windowMs }));
        }

        return next();
    };
};

export const createThrottler = ({
    waitTimeMs = 2000,
    ttlMs = 60 * 1000,
    allowedRequests = 1,
    burstWindowMs = 10 * 1000,
    keyPrefix = DEFAULT_KEY_PREFIX,
    keyGenerator = defaultKeyGenerator("ip")
} = {}) => {
    return (req, res, next) => {
        pruneOccasionally("throttle", Math.max(ttlMs, burstWindowMs) * 2);

        const current = now();
        const key = `${keyPrefix}:${keyGenerator(req)}`;
        const existing = stores.throttle.get(key) || {
            previousDelay: 0,
            lastRequestAt: current - waitTimeMs,
            requestCount: 0,
            windowStart: current
        };

        if (current - existing.windowStart > burstWindowMs) {
            existing.requestCount = 0;
            existing.windowStart = current;
            existing.previousDelay = 0;
        }

        existing.requestCount += 1;

        let delay = 0;
        if (existing.requestCount > allowedRequests) {
            const timePassed = current - existing.lastRequestAt;
            delay = Math.max(0, waitTimeMs + existing.previousDelay - timePassed);
        }

        existing.previousDelay = delay;
        existing.lastRequestAt = current;
        stores.throttle.set(key, existing);

        if (delay <= 0) {
            return next();
        }

        res.setHeader("X-Throttle-Delay-Ms", delay);
        setTimeout(next, delay);
    };
};

export const securityKeyGenerators = {
    byIp: defaultKeyGenerator("ip"),
    byUser: defaultKeyGenerator("user"),
    byUserOrIp: defaultKeyGenerator("user-or-ip")
};
