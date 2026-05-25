import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set and be at least 32 characters long");
}

export const generateToken = (payload, expiryTime) => jwt.sign(payload, JWT_SECRET, {
    expiresIn: expiryTime
});

export const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
};
