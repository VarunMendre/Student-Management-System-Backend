import fs from "fs";
import path from "path";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const STORAGE_DRIVER = (process.env.FILE_STORAGE_DRIVER || "local").toLowerCase();
const S3_REGION = process.env.S3_REGION;
const S3_BUCKET = process.env.S3_BUCKET_NAME;
const S3_ENDPOINT = process.env.S3_ENDPOINT || undefined;
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_KEY = process.env.S3_SECRET_ACCESS_KEY;
const S3_FORCE_PATH_STYLE = String(process.env.S3_FORCE_PATH_STYLE || "false").toLowerCase() === "true";

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

const loadLocalFileBuffer = async (storedPath) => {
    const uploadsRoot = process.env.UPLOADS_ROOT
        ? path.resolve(process.cwd(), process.env.UPLOADS_ROOT)
        : path.resolve(process.cwd(), "uploads");
    const absolutePath = path.resolve(uploadsRoot, storedPath.replace(/^\/uploads\//, ""));
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

export const getScholarshipFormBuffer = async (storedPath) => {
    if (!storedPath) {
        throw new Error("Stored scholarship file path is missing");
    }

    if (STORAGE_DRIVER !== "s3" || isLocalStoragePath(storedPath)) {
        return loadLocalFileBuffer(storedPath);
    }

    return loadS3ObjectBuffer(storedPath);
};
