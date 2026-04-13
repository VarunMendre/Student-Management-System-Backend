import courseModel from "../models/courseModel.js";

const getAllCourses = async () => {
    return await courseModel.findAll();
};

const getCourseById = async (id) => {
    return await courseModel.findById(id);
};

const createCourse = async (courseData) => {
    return await courseModel.create(courseData);
};

const updateCourse = async (id, courseData) => {
    return await courseModel.update(id, courseData);
};

const deleteCourse = async (id) => {
    return await courseModel.remove(id);
};

export default {
    getAllCourses,
    getCourseById,
    createCourse,
    updateCourse,
    deleteCourse
};
