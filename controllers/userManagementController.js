import bcrypt from "bcryptjs";
import userModel from "../models/userModel.js";
import asyncHandler from "../utils/asyncHandler.js";
import { CustomError } from "../utils/customError.js";
import { successResponse } from "../utils/customResponse.js";

const CREATABLE_STAFF_ROLES = ["accountant", "admin"];
const EDITABLE_ROLES = ["accountant", "admin"];

const buildDefaultPassword = (contactNumber) => `${contactNumber}`;

const ensureManageableUser = async (userId) => {
    const existingUser = await userModel.findById(userId);
    if (!existingUser) {
        throw new CustomError("User not found", 404);
    }

    if (existingUser.role === "principal") {
        throw new CustomError("Principal account cannot be modified from this page", 400);
    }

    return existingUser;
};

export const getAllUsers = asyncHandler(async (req, res) => {
    const users = await userModel.getAllStaffUsers();
    successResponse(res, { data: users }, "Users fetched successfully");
});

export const createUser = asyncHandler(async (req, res) => {
    const { name, email, contact_number, role } = req.body;

    if (!name || !email || !contact_number || !role) {
        throw new CustomError("Name, email, contact number and role are required", 400);
    }

    if (!CREATABLE_STAFF_ROLES.includes(role)) {
        throw new CustomError("Only accountant and admin users can be created from this page", 400);
    }

    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
        throw new CustomError("Email already exists", 409);
    }

    const hashedPassword = await bcrypt.hash(buildDefaultPassword(contact_number), 12);
    const createdUser = await userModel.createUser({
        name,
        email,
        password: hashedPassword,
        contact_number,
        role
    });

    successResponse(res, { user: createdUser }, "User created successfully", 201);
});

export const updateUserRole = asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    const { role } = req.body;

    if (!EDITABLE_ROLES.includes(role)) {
        throw new CustomError("Invalid role selected", 400);
    }

    await ensureManageableUser(userId);
    const updatedUser = await userModel.updateRole(userId, role);
    successResponse(res, { user: updatedUser }, "User role updated successfully");
});

export const deactivateUser = asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    await ensureManageableUser(userId);
    const updatedUser = await userModel.setActiveStatus(userId, false);

    successResponse(res, { user: updatedUser }, "User deactivated successfully");
});

export const recoverUser = asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    await ensureManageableUser(userId);
    const updatedUser = await userModel.setActiveStatus(userId, true);

    successResponse(res, { user: updatedUser }, "User recovered successfully");
});

export const deleteUser = asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    await ensureManageableUser(userId);
    const deletedUser = await userModel.deleteById(userId);

    successResponse(res, { user: deletedUser }, "User deleted permanently");
});

export const forceLogout = asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    await ensureManageableUser(userId);
    const updatedUser = await userModel.updateRefreshToken(userId, null);

    successResponse(res, { user: updatedUser }, "User session cleared successfully");
});
