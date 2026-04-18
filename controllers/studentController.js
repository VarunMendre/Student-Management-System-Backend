import studentService from "../services/studentService.js";
import asyncHandler from "../utils/asyncHandler.js";
import { successResponse } from "../utils/customResponse.js";

export const enrollStudent = asyncHandler(async (req, res) => {
    const result = await studentService.enrollStudent(req.body);
    successResponse(res, result, "Student enrolled successfully", 201);
});

export const listStudents = asyncHandler(async (req, res) => {
    const { page, limit, search, department_id, course_id, batch_id, status } = req.query;
    const students = await studentService.listStudents({
        page,
        limit,
        search,
        department_id,
        course_id,
        batch_id,
        status
    });
    successResponse(res, students, "Students fetched successfully");
});

export const getStudent = asyncHandler(async (req, res) => {
    const student = await studentService.getStudentById(parseInt(req.params.id));
    successResponse(res, student, "Student details fetched successfully");
});

export const updateStudent = asyncHandler(async (req, res) => {
    const result = await studentService.updateStudent(parseInt(req.params.id), req.body);
    successResponse(res, result, "Student updated successfully");
});
