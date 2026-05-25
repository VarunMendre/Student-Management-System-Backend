import fs from "fs";
import path from "path";
import crypto from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const STORAGE_DRIVER = (process.env.FILE_STORAGE_DRIVER || "local").toLowerCase();
const S3_REGION = process.env.S3_REGION;
const S3_BUCKET = process.env.S3_BUCKET_NAME;
const S3_ENDPOINT = process.env.S3_ENDPOINT || undefined;
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_KEY = process.env.S3_SECRET_ACCESS_KEY;
const S3_FORCE_PATH_STYLE = String(process.env.S3_FORCE_PATH_STYLE || "false").toLowerCase() === "true";
const S3_SIGNED_URL_EXPIRES_SECONDS = Number(process.env.S3_SIGNED_URL_EXPIRES_SECONDS || 900);

const uploadsRoot = path.resolve(process.cwd(), "uploads");
const PUBLIC_API_BASE_URL = String(process.env.PUBLIC_API_BASE_URL || "").trim().replace(/\/+$/, "");

const ensureLocalUploadDir = () => {
    fs.mkdirSync(path.resolve(uploadsRoot, "scholarship-forms"), { recursive: true });
};

const isLocalStoragePath = (storedPath = "") => storedPath.startsWith("/uploads/");

const getS3Client = () => {
    if (STORAGE_DRIVER !== "s3") {
        return null;
    }

    if (!S3_BUCKET || !S3_REGION || !S3_ACCESS_KEY || !S3_SECRET_KEY) {
        throw new Error("S3 storage is enabled but S3_BUCKET_NAME, S3_REGION, S3_ACCESS_KEY_ID, or S3_SECRET_ACCESS_KEY is missing");
    }

    return new S3Client({
        region: S3_REGION,
        endpoint: S3_ENDPOINT,
        forcePathStyle: S3_FORCE_PATH_STYLE,
        credentials: {
            accessKeyId: S3_ACCESS_KEY,
            secretAccessKey: S3_SECRET_KEY
        }
    });
};

const sanitizeBaseName = (name = "form") => name.replace(/[^a-zA-Z0-9_-]/g, "_");

const buildScholarshipObjectKey = ({ originalName, studentId, applicationId }) => {
    const ext = path.extname(originalName || ".pdf").toLowerCase() || ".pdf";
    const base = sanitizeBaseName(path.basename(originalName || "scholarship_form", ext));
    const datePrefix = new Date().toISOString().slice(0, 10);
    const randomId = crypto.randomUUID().slice(0, 8);
    return `scholarship-forms/${datePrefix}/${studentId}/${applicationId}_${Date.now()}_${randomId}_${base}${ext}`;
};

const uploadToLocalDisk = async ({ buffer, originalName }) => {
    ensureLocalUploadDir();
    const ext = path.extname(originalName || ".pdf").toLowerCase() || ".pdf";
    const base = sanitizeBaseName(path.basename(originalName || "scholarship_form", ext));
    const fileName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${base}${ext}`;
    const absolutePath = path.resolve(uploadsRoot, "scholarship-forms", fileName);
    await fs.promises.writeFile(absolutePath, buffer);
    return `/uploads/scholarship-forms/${fileName}`;
};

const uploadToS3 = async ({ buffer, originalName, mimeType, studentId, applicationId }) => {
    const client = getS3Client();
    const objectKey = buildScholarshipObjectKey({ originalName, studentId, applicationId });

    await client.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: objectKey,
        Body: buffer,
        ContentType: mimeType || "application/octet-stream"
    }));

    return objectKey;
};

const deleteLocalFile = async (storedPath) => {
    if (!isLocalStoragePath(storedPath)) return;
    const absolutePath = path.resolve(process.cwd(), storedPath.replace(/^\/uploads\//, "uploads/"));
    try {
        await fs.promises.unlink(absolutePath);
    } catch {
        // ignore cleanup failures
    }
};

const deleteS3Object = async (storedPath) => {
    if (!storedPath || isLocalStoragePath(storedPath)) return;
    const client = getS3Client();
    await client.send(new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: storedPath
    }));
};

const buildLocalAccessUrl = (storedPath, requestOrigin) => `${(PUBLIC_API_BASE_URL || requestOrigin || "").replace(/\/+$/, "")}${storedPath}`;

const buildS3SignedAccessUrl = async (storedPath) => {
    const client = getS3Client();
    return getSignedUrl(client, new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: storedPath
    }), {
        expiresIn: S3_SIGNED_URL_EXPIRES_SECONDS
    });
};

const loadLocalFileBuffer = async (storedPath) => {
    const absolutePath = path.resolve(process.cwd(), storedPath.replace(/^\/uploads\//, "uploads/"));
    return fs.promises.readFile(absolutePath);
};

const loadS3ObjectBuffer = async (storedPath) => {
    const client = getS3Client();
    const response = await client.send(new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: storedPath
    }));
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
};

export const uploadScholarshipForm = async ({ buffer, originalName, mimeType, studentId, applicationId }) => {
    if (!buffer?.length) {
        throw new Error("Scholarship file buffer is missing");
    }

    if (STORAGE_DRIVER === "s3") {
        return uploadToS3({ buffer, originalName, mimeType, studentId, applicationId });
    }

    return uploadToLocalDisk({ buffer, originalName });
};

export const deleteStoredScholarshipForm = async (storedPath) => {
    if (!storedPath) return;

    if (isLocalStoragePath(storedPath)) {
        await deleteLocalFile(storedPath);
        return;
    }

    await deleteS3Object(storedPath);
};

export const getScholarshipFormAccessUrl = async ({ storedPath, requestOrigin }) => {
    if (!storedPath) return null;
    if (isLocalStoragePath(storedPath)) {
        return buildLocalAccessUrl(storedPath, requestOrigin);
    }
    return buildS3SignedAccessUrl(storedPath);
};

export const getScholarshipFormBuffer = async (storedPath) => {
    if (!storedPath) {
        throw new Error("Stored scholarship file path is missing");
    }

    if (isLocalStoragePath(storedPath)) {
        return loadLocalFileBuffer(storedPath);
    }

    return loadS3ObjectBuffer(storedPath);
};
