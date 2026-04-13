import { pool } from "../config/db.js";

const findAll = async () => {
    const { rows } = await pool.query("SELECT * FROM departments ORDER BY created_at DESC");
    return rows;
};

const findById = async (id) => {
    const { rows } = await pool.query("SELECT * FROM departments WHERE id = $1", [id]);
    return rows[0];
};

const create = async (name) => {
    const { rows } = await pool.query(
        "INSERT INTO departments (name) VALUES ($1) RETURNING *",
        [name]
    );
    return rows[0];
};

const update = async (id, name) => {
    const { rows } = await pool.query(
        "UPDATE departments SET name = $1 WHERE id = $2 RETURNING *",
        [name, id]
    );
    return rows[0];
};

const remove = async (id) => {
    const { rows } = await pool.query(
        "DELETE FROM departments WHERE id = $1 RETURNING *",
        [id]
    );
    return rows[0];
};

export default {
    findAll,
    findById,
    create,
    update,
    remove
};
