import departmentService from "../services/departmentService.js";
import asyncHandler from "../utils/asyncHandler.js";
import { successResponse } from "../utils/customResponse.js";
import { CustomError } from "../utils/customError.js";

export const getAllDepartments = asyncHandler(async (req, res, next) => {
    const departments = await departmentService.getAllDepartments();
    successResponse(res, departments, "Departments fetched successfully");
});

export const getDepartmentById = asyncHandler(async (req, res, next) => {
    const department = await departmentService.getDepartmentById(req.params.id);
    if (!department) {
        throw new CustomError("Department not found", 404);
    }
    successResponse(res, department, "Department fetched successfully");
})

export const createDepartment = asyncHandler(async (req, res, next) => {
    const { name } = req.body;

    if (!name) {
        throw new CustomError("Department name is required", 400);
    }

    const newDepartment = await departmentService.createDepartment({ name });
    successResponse(res, newDepartment, "Department created successfully", 201);
});

export const updateDepartment = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
        throw new CustomError("Department name is required", 400);
    }

    const updatedDepartment = await departmentService.updateDepartment(id, { name });
    
    if (!updatedDepartment) {
        throw new CustomError("Department not found", 404);
    }

    successResponse(res, updatedDepartment, "Department updated successfully");
});

export const deleteDepartment = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    if (!id) {
        throw new CustomError("Department ID is required", 400);
    }

    const deletedDepartment = await departmentService.deleteDepartment(id);
    
    if (!deletedDepartment) {
        throw new CustomError("Department not found", 404);
    }

    successResponse(res, deletedDepartment, "Department deleted successfully");
});

