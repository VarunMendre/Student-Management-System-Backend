import departmentModel from "../models/departmentModel.js";

const getAllDepartments = async () => {
    return await departmentModel.findAll();
};

const getDepartmentById = async (id) => {
    return await departmentModel.findById(id);
};

const createDepartment = async (departmentData) => {
    const { name } = departmentData;
    return await departmentModel.create(name);
};

const updateDepartment = async (id, departmentData) => {
    const { name } = departmentData;
    return await departmentModel.update(id, name);
};

const deleteDepartment = async (id) => {
    return await departmentModel.remove(id);
};

export default {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment
};
