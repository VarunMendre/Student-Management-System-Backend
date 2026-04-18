import courseService from "../services/courseService.js";
import asyncHandler from "../utils/asyncHandler.js";
import { successResponse } from "../utils/customResponse.js";
import { CustomError, ErrorCodes } from "../utils/customError.js";

export const getAllCourses = asyncHandler(async (req, res) => {
    const courses = await courseService.getAllCourses();
    successResponse(res, courses, "Courses fetched successfully");
});

export const getCourseById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const course = await courseService.getCourseById(id);
    
    if (!course) {
        throw new CustomError({
            message: "Course not found",
            statusCode: 404,
            code: ErrorCodes.NOT_FOUND
        });
    }
    
    successResponse(res, course, "Course details fetched successfully");
});

export const createCourse = asyncHandler(async (req, res) => {
    const { course_name, duration, department_id, course_code, program_level } = req.body;

    if (!course_name || !department_id || !course_code) {
        throw new CustomError({
            message: "Course name, department ID, and course code are required",
            statusCode: 400,
            code: ErrorCodes.VALIDATION_ERROR
        });
    }

    const newCourse = await courseService.createCourse({
        course_name,
        duration,
        department_id,
        course_code,
        program_level
    });

    successResponse(res, newCourse, "Course created successfully", 201);
});

export const updateCourse = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { course_name, duration, department_id, course_code, program_level } = req.body;

    const updatedCourse = await courseService.updateCourse(id, {
        course_name,
        duration,
        department_id,
        course_code,
        program_level
    });

    if (!updatedCourse) {
        throw new CustomError({
            message: "Course not found",
            statusCode: 404,
            code: ErrorCodes.NOT_FOUND
        });
    }

    successResponse(res, updatedCourse, "Course updated successfully");
});

export const deleteCourse = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const deletedCourse = await courseService.deleteCourse(id);

    if (!deletedCourse) {
        throw new CustomError({
            message: "Course not found",
            statusCode: 404,
            code: ErrorCodes.NOT_FOUND
        });
    }

    successResponse(res, deletedCourse, "Course deleted successfully");
});
