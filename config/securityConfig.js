import {
    createRateLimiter,
    createThrottler,
    securityKeyGenerators
} from "../middleware/securityMiddleware.js";

const SECOND = 1000;
const MINUTE = 60 * SECOND;

const buildRateLimiters = (config, keyGenerator) => Object.fromEntries(
    Object.entries(config).map(([name, options]) => [
        name,
        createRateLimiter({
            ...options,
            keyPrefix: `rate:${name}`,
            keyGenerator
        })
    ])
);

const buildThrottlers = (config, keyGenerator) => Object.fromEntries(
    Object.entries(config).map(([name, options]) => [
        name,
        createThrottler({
            ...options,
            keyPrefix: `throttle:${name}`,
            keyGenerator
        })
    ])
);

const publicRateLimiterConfig = {
    globalApi: {
        windowMs: 15 * MINUTE,
        limit: 300,
        message: "Too many API requests from this IP. Please try again later."
    },
    authLogin: {
        windowMs: 15 * MINUTE,
        limit: 10,
        message: "Too many login attempts. Please try again later."
    },
    authRefresh: {
        windowMs: 15 * MINUTE,
        limit: 20,
        message: "Too many token refresh requests. Please try again later."
    },
    authLogout: {
        windowMs: 5 * MINUTE,
        limit: 30,
        message: "Too many logout requests. Please slow down."
    },
    authProfileRead: {
        windowMs: 5 * MINUTE,
        limit: 60,
        message: "Too many profile requests. Please slow down."
    },
    authProfileUpdate: {
        windowMs: 10 * MINUTE,
        limit: 20,
        message: "Too many profile update attempts. Please slow down."
    },
    passwordReset: {
        windowMs: 15 * MINUTE,
        limit: 5,
        message: "Too many password reset attempts. Please try again later."
    },
    checkEmail: {
        windowMs: 10 * MINUTE,
        limit: 20,
        message: "Too many email lookup requests. Please try again later."
    }
};

const privateRateLimiterConfig = {
    adminRead: {
        windowMs: 5 * MINUTE,
        limit: 120,
        message: "Too many admin read requests. Please slow down."
    },
    adminWrite: {
        windowMs: 10 * MINUTE,
        limit: 40,
        message: "Too many admin write requests. Please slow down."
    },
    catalogRead: {
        windowMs: 5 * MINUTE,
        limit: 180,
        message: "Too many read requests. Please slow down."
    },
    catalogWrite: {
        windowMs: 10 * MINUTE,
        limit: 50,
        message: "Too many write requests. Please slow down."
    },
    studentRead: {
        windowMs: 5 * MINUTE,
        limit: 180,
        message: "Too many student requests. Please slow down."
    },
    studentWrite: {
        windowMs: 10 * MINUTE,
        limit: 50,
        message: "Too many student write requests. Please slow down."
    },
    bulkImport: {
        windowMs: 15 * MINUTE,
        limit: 8,
        message: "Too many bulk import attempts. Please try again later."
    },
    paymentWrite: {
        windowMs: 10 * MINUTE,
        limit: 40,
        message: "Too many payment requests. Please slow down."
    },
    transactionRead: {
        windowMs: 5 * MINUTE,
        limit: 120,
        message: "Too many transaction requests. Please slow down."
    },
    scholarshipRead: {
        windowMs: 5 * MINUTE,
        limit: 120,
        message: "Too many scholarship requests. Please slow down."
    },
    scholarshipWrite: {
        windowMs: 10 * MINUTE,
        limit: 25,
        message: "Too many scholarship write requests. Please slow down."
    },
    scholarshipUpload: {
        windowMs: 15 * MINUTE,
        limit: 6,
        message: "Too many scholarship submission attempts. Please try again later."
    }
};

const publicThrottleConfig = {
    authLogin: {
        waitTimeMs: 2 * SECOND,
        ttlMs: 5 * MINUTE,
        allowedRequests: 2,
        burstWindowMs: 15 * SECOND
    },
    authRefresh: {
        waitTimeMs: 1500,
        ttlMs: 5 * MINUTE,
        allowedRequests: 3,
        burstWindowMs: 15 * SECOND
    },
    passwordReset: {
        waitTimeMs: 2500,
        ttlMs: 10 * MINUTE,
        allowedRequests: 1,
        burstWindowMs: 15 * SECOND
    },
    checkEmail: {
        waitTimeMs: 1200,
        ttlMs: 5 * MINUTE,
        allowedRequests: 3,
        burstWindowMs: 10 * SECOND
    }
};

const privateThrottleConfig = {
    bulkImport: {
        waitTimeMs: 2 * SECOND,
        ttlMs: 10 * MINUTE,
        allowedRequests: 1,
        burstWindowMs: 30 * SECOND
    },
    scholarshipUpload: {
        waitTimeMs: 2 * SECOND,
        ttlMs: 10 * MINUTE,
        allowedRequests: 1,
        burstWindowMs: 20 * SECOND
    },
    scholarshipWrite: {
        waitTimeMs: 1500,
        ttlMs: 5 * MINUTE,
        allowedRequests: 2,
        burstWindowMs: 20 * SECOND
    },
    adminWrite: {
        waitTimeMs: SECOND,
        ttlMs: 5 * MINUTE,
        allowedRequests: 3,
        burstWindowMs: 15 * SECOND
    }
};

export const rateLimiters = {
    ...buildRateLimiters(publicRateLimiterConfig, securityKeyGenerators.byIp),
    ...buildRateLimiters(privateRateLimiterConfig, securityKeyGenerators.byUserOrIp)
};

export const throttlers = {
    ...buildThrottlers(publicThrottleConfig, securityKeyGenerators.byIp),
    ...buildThrottlers(privateThrottleConfig, securityKeyGenerators.byUserOrIp)
};
