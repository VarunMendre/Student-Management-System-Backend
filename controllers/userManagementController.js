import userManagementService from "../services/userManagementService.js";
import asyncHandler from "../utils/asyncHandler.js";
import { successResponse } from "../utils/customResponse.js";

export const getAllUsers = asyncHandler(async (req, res) => {
    const users = await userManagementService.getAllUsers();
    successResponse(res, { data: users }, "Users fetched successfully");
});

export const createUser = asyncHandler(async (req, res) => {
    const createdUser = await userManagementService.createUser(req.body);

    successResponse(res, { user: createdUser }, "User created successfully", 201);
});

export const updateUserRole = asyncHandler(async (req, res) => {
    const updatedUser = await userManagementService.updateUserRole(req.params.id, req.body.role);
    successResponse(res, { user: updatedUser }, "User role updated successfully");
});

export const deactivateUser = asyncHandler(async (req, res) => {
    const updatedUser = await userManagementService.deactivateUser(req.params.id);

    successResponse(res, { user: updatedUser }, "User deactivated successfully");
});

export const recoverUser = asyncHandler(async (req, res) => {
    const updatedUser = await userManagementService.recoverUser(req.params.id);

    successResponse(res, { user: updatedUser }, "User recovered successfully");
});

export const deleteUser = asyncHandler(async (req, res) => {
    const deletedUser = await userManagementService.deleteUser(req.params.id);

    successResponse(res, { user: deletedUser }, "User deleted permanently");
});

export const forceLogout = asyncHandler(async (req, res) => {
    const updatedUser = await userManagementService.forceLogout(req.params.id);

    successResponse(res, { user: updatedUser }, "User session cleared successfully");
});

export const checkEmailExists = asyncHandler(async (req, res) => {
    const { email } = req.query;
    const userId = req.user?.userId;
    const exists = await userManagementService.checkEmailDuplicate(email, userId);
    res.json({ exists });
});
