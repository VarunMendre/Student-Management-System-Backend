import { pool } from "../config/db.js";

const getAllDepartments = async () => {
    const { rows } = await pool.query("SELECT * FROM departments ORDER BY created_at DESC");
    return rows;
};

const getDepartmentById = async (id) => {
    const { rows } = await pool.query("SELECT * FROM departments WHERE id = $1", [id]);
    return rows[0];
};

const createDepartment = async (departmentData) => {
    const { name } = departmentData;
    const { rows } = await pool.query(
        "INSERT INTO departments (name) VALUES ($1) RETURNING *",
        [name]
    );
    return rows[0];
};

const updateDepartment = async (id, departmentData) => {
    const { name } = departmentData;
    const { rows } = await pool.query(
        "UPDATE departments SET name = $1 WHERE id = $2 RETURNING *",
        [name, id]
    );
    return rows[0];
};

const deleteDepartment = async (id) => {
    const { rows } = await pool.query(
        "DELETE FROM departments WHERE id = $1 RETURNING *",
        [id]
    );
    return rows[0];
};

export default {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment
};
