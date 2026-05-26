import "dotenv/config";
import express from "express";
import cors from "cors";                          
import cookieParser from "cookie-parser";
import path from "path";
import departmentRoutes from "./routes/departmentRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import batchRoutes from "./routes/batchRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import scholarshipRoutes from "./routes/scholarshipRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userManagementRoutes from "./routes/userManagementRoutes.js";
import { verifyAccessToken } from "./middleware/authMiddleware.js";
import { rateLimiters } from "./config/securityConfig.js";
import { CustomError, ErrorCodes } from "./utils/customError.js";
import { securityHeaders } from "./middleware/appSecurityMiddleware.js";

const app = express();
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173/")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }
        
        const normalizedOrigin = origin.replace(/\/+$/, "");
        if (allowedOrigins.length === 0 || allowedOrigins.includes(normalizedOrigin)) {
            return callback(null, true);
        }
        
        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
    optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(securityHeaders);
app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
app.use((req, res, next) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    req.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
});

app.get("/", (req, res) => {
    res.send("MySQL + Express API is running Hello World!");
});

app.use("/api/v1", rateLimiters.globalApi);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", verifyAccessToken);
app.use("/api/v1/departments", departmentRoutes);
app.use("/api/v1/courses", courseRoutes);
app.use("/api/v1/batches", batchRoutes);
app.use("/api/v1/students", studentRoutes);
app.use("/api/v1/scholarship", scholarshipRoutes);
app.use("/api/v1/transactions", transactionRoutes);
app.use("/api/v1/users", userManagementRoutes);

// error handling middleware
app.use((err, req, res, next) => {
    const normalizedError = err instanceof CustomError
        ? err
        : err?.name === "MulterError"
            ? new CustomError({
                message: err.code === "LIMIT_FILE_SIZE"
                    ? "Uploaded file is too large"
                    : "Invalid upload request",
                statusCode: 400,
                code: ErrorCodes.VALIDATION_ERROR,
                details: process.env.NODE_ENV !== "production" && err?.message
                    ? { originalMessage: err.message, code: err.code || null }
                    : null
            })
            : new CustomError({
                message: "Internal Server Error",
                statusCode: 500,
                code: ErrorCodes.INTERNAL_ERROR,
                isOperational: false,
                cause: err,
                details: process.env.NODE_ENV !== "production" && err?.message
                    ? { originalMessage: err.message }
                    : null
            });

    const statusCode = normalizedError.statusCode || 500;
    const timestamp = normalizedError.timestamp || new Date().toISOString();

    console.error({
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode,
        code: normalizedError.code,
        message: normalizedError.message,
        isOperational: normalizedError.isOperational,
        details: normalizedError.details || null,
        timestamp,
        stack: normalizedError.stack,
        cause: normalizedError.cause?.message || null
    });

    const response = {
        success: false,
        error: {
            message: normalizedError.message || "Internal Server Error",
            code: normalizedError.code || ErrorCodes.INTERNAL_ERROR,
            statusCode,
            timestamp,
            requestId: req.requestId
        }
    };

    if (normalizedError.details) {
        response.error.details = normalizedError.details;
    }
    if (normalizedError.fieldErrors) {
        response.error.fieldErrors = normalizedError.fieldErrors;
    }

    if (process.env.NODE_ENV !== "production" && normalizedError.stack) {
        response.error.stack = normalizedError.stack;
    }

    res.status(statusCode).json(response);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Express Server Started Listening on ${PORT}`);
});
