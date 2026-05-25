import courseModel from "../models/courseModel.js";
import { formatCourseDuration } from "../utils/courseDuration.js";

const getAllCourses = async () => {
    return await courseModel.findAll();
};

const getCourseById = async (id) => {
    return await courseModel.findById(id);
};

const createCourse = async (courseData) => {
    return await courseModel.create({
        ...courseData,
        duration: formatCourseDuration(courseData.duration)
    });
};

const updateCourse = async (id, courseData) => {
    return await courseModel.update(id, {
        ...courseData,
        duration: courseData.duration === undefined ? undefined : formatCourseDuration(courseData.duration)
    });
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
