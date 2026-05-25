import bcrypt from "bcryptjs";
import crypto from "crypto";
import userModel from "../models/userModel.js";
import { CustomError, ErrorCodes } from "../utils/customError.js";

const CREATABLE_STAFF_ROLES = ["accountant", "admin"];
const EDITABLE_ROLES = ["accountant", "admin"];

const generateTemporaryPassword = () => crypto.randomBytes(12).toString("base64url");

const validateUserId = (userId) => {
    const parsedUserId = Number(userId);

    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        throw new CustomError({
            message: "Invalid user id",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }

    return parsedUserId;
};

const ensureManageableUser = async (userId) => {
    const existingUser = await userModel.findById(userId);

    if (!existingUser) {
        throw new CustomError({
            message: "User not found",
            statusCode: 404,
            code: ErrorCodes.NOT_FOUND
        });
    }

    if (existingUser.role === "principal") {
        throw new CustomError({
            message: "Principal account cannot be modified from this page",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }

    return existingUser;
};

const getAllUsers = () => userModel.getAllStaffUsers();

const createUser = async ({ name, email, contact_number, role }) => {
    if (!name || !email || !contact_number || !role) {
        throw new CustomError({
            message: "Name, email, contact number and role are required",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }

    if (!CREATABLE_STAFF_ROLES.includes(role)) {
        throw new CustomError({
            message: "Only accountant and admin users can be created from this page",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }

    const existingUser = await userModel.findByEmail(email);

    if (existingUser) {
        throw new CustomError({
            message: "Email already exists",
            statusCode: 409,
            code: ErrorCodes.DUPLICATE_ENTRY
        });
    }

    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    const createdUser = await userModel.createUser({
        name,
        email,
        password: hashedPassword,
        contact_number,
        role
    });

    return {
        ...createdUser,
        temporary_password: temporaryPassword
    };
};

const updateUserRole = async (userId, role) => {
    const parsedUserId = validateUserId(userId);

    if (!EDITABLE_ROLES.includes(role)) {
        throw new CustomError({
            message: "Invalid role selected",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }

    await ensureManageableUser(parsedUserId);
    return userModel.updateRole(parsedUserId, role);
};

const deactivateUser = async (userId) => {
    const parsedUserId = validateUserId(userId);
    await ensureManageableUser(parsedUserId);
    return userModel.setActiveStatus(parsedUserId, false);
};

const recoverUser = async (userId) => {
    const parsedUserId = validateUserId(userId);
    await ensureManageableUser(parsedUserId);
    return userModel.setActiveStatus(parsedUserId, true);
};

const deleteUser = async (userId) => {
    const parsedUserId = validateUserId(userId);
    await ensureManageableUser(parsedUserId);
    return userModel.deleteById(parsedUserId);
};

const forceLogout = async (userId) => {
    const parsedUserId = validateUserId(userId);
    await ensureManageableUser(parsedUserId);
    return userModel.updateRefreshToken(parsedUserId, null);
};

const checkEmailDuplicate = async (email, currentUserId) => {
    const existingUser = currentUserId 
        ? await userModel.findByEmailExcludingId(email, currentUserId)
        : await userModel.findByEmail(email);
    return !!existingUser;
};

export default {
    getAllUsers,
    createUser,
    updateUserRole,
    deactivateUser,
    recoverUser,
    deleteUser,
    forceLogout,
    checkEmailDuplicate
};
