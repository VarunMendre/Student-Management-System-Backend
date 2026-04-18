import departmentService from "../services/departmentService.js";
import asyncHandler from "../utils/asyncHandler.js";
import { successResponse } from "../utils/customResponse.js";
import { CustomError, ErrorCodes } from "../utils/customError.js";

export const getAllDepartments = asyncHandler(async (req, res) => {
    const departments = await departmentService.getAllDepartments();
    successResponse(res, departments, "Departments fetched successfully");
});

export const getDepartmentById = asyncHandler(async (req, res) => {
    const department = await departmentService.getDepartmentById(req.params.id);
    if (!department) {
        throw new CustomError({
            message: "Department not found",
            statusCode: 404,
            code: ErrorCodes.NOT_FOUND
        });
    }
    successResponse(res, department, "Department fetched successfully");
});

export const createDepartment = asyncHandler(async (req, res) => {
    const { name } = req.body;
    const newDepartment = await departmentService.createDepartment({ name });
    successResponse(res, newDepartment, "Department created successfully", 201);
});

export const updateDepartment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    const updatedDepartment = await departmentService.updateDepartment(id, { name });
    
    if (!updatedDepartment) {
        throw new CustomError({
            message: "Department not found",
            statusCode: 404,
            code: ErrorCodes.NOT_FOUND
        });
    }

    successResponse(res, updatedDepartment, "Department updated successfully");
});

export const deleteDepartment = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const deletedDepartment = await departmentService.deleteDepartment(id);
    
    if (!deletedDepartment) {
        throw new CustomError({
            message: "Department not found",
            statusCode: 404,
            code: ErrorCodes.NOT_FOUND
        });
    }

    successResponse(res, deletedDepartment, "Department deleted successfully");
});
