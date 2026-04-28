import { pool } from "../config/db.js";

const findAll = async () => {
    const [rows] = await pool.query("SELECT * FROM departments ORDER BY created_at DESC");
    return rows;
};

const findById = async (id) => {
    const [rows] = await pool.query("SELECT * FROM departments WHERE id = ?", [id]);
    return rows[0];
};

const create = async (name) => {
    const [result] = await pool.query(
        "INSERT INTO departments (name) VALUES (?)",
        [name]
    );
    const [rows] = await pool.query("SELECT * FROM departments WHERE id = ?", [result.insertId]);
    return rows[0];
};

const update = async (id, name) => {
    await pool.query(
        "UPDATE departments SET name = ? WHERE id = ?",
        [name, id]
    );
    const [rows] = await pool.query("SELECT * FROM departments WHERE id = ?", [id]);
    return rows[0];
};

const remove = async (id) => {
    const [rows] = await pool.query("SELECT * FROM departments WHERE id = ?", [id]);
    const dept = rows[0];
    if (dept) {
        await pool.query("DELETE FROM departments WHERE id = ?", [id]);
    }
    return dept;
};

export default {
    findAll,
    findById,
    create,
    update,
    remove
};
