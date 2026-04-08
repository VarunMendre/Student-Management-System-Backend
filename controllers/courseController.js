import courseService from "../services/courseService.js";
import asyncHandler from "../utils/asyncHandler.js";
import { successResponse } from "../utils/customResponse.js";
import { CustomError } from "../utils/customError.js";

export const getAllCourses = asyncHandler(async (req, res) => {
    const courses = await courseService.getAllCourses();
    successResponse(res, courses, "Courses fetched successfully");
});

export const getCourseById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const course = await courseService.getCourseById(id);
    
    if (!course) {
        throw new CustomError("Course not found", 404);
    }
    
    successResponse(res, course, "Course details fetched successfully");
});

export const createCourse = asyncHandler(async (req, res) => {
    const { course_name, duration, department_id, course_code, program_level, seats } = req.body;

    if (!course_name || !department_id || !course_code) {
        throw new CustomError("Course name, department ID, and course code are required", 400);
    }

    const newCourse = await courseService.createCourse({
        course_name,
        duration,
        department_id,
        course_code,
        program_level,
        seats
    });

    successResponse(res, newCourse, "Course created successfully", 201);
});

export const updateCourse = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { course_name, duration, department_id, course_code, program_level, seats } = req.body;

    const updatedCourse = await courseService.updateCourse(id, {
        course_name,
        duration,
        department_id,
        course_code,
        program_level,
        seats
    });

    if (!updatedCourse) {
        throw new CustomError("Course not found", 404);
    }

    successResponse(res, updatedCourse, "Course updated successfully");
});

export const deleteCourse = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const deletedCourse = await courseService.deleteCourse(id);

    if (!deletedCourse) {
        throw new CustomError("Course not found", 404);
    }

    successResponse(res, deletedCourse, "Course deleted successfully");
});
