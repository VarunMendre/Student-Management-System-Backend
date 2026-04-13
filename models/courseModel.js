import { pool } from "../config/db.js";

const findAll = async () => {
    const { rows } = await pool.query(`
        SELECT c.*, d.name as department_name 
        FROM courses c 
        LEFT JOIN departments d ON c.department_id = d.id 
        ORDER BY c.created_at DESC
    `);
    return rows;
};

const findById = async (id) => {
    const { rows } = await pool.query(`
        SELECT c.*, d.name as department_name 
        FROM courses c 
        LEFT JOIN departments d ON c.department_id = d.id 
        WHERE c.id = $1
    `, [id]);
    return rows[0];
};

const create = async (data) => {
    const { course_name, duration, department_id, course_code, program_level, seats } = data;
    const { rows } = await pool.query(
        `INSERT INTO courses 
        (course_name, duration, department_id, course_code, program_level, seats) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING *`,
        [course_name, duration, department_id, course_code, program_level, seats]
    );
    return rows[0];
};

const update = async (id, data) => {
    const { course_name, duration, department_id, course_code, program_level, seats } = data;
    const { rows } = await pool.query(
        `UPDATE courses 
        SET course_name = $1, duration = $2, department_id = $3, course_code = $4, program_level = $5, seats = $6 
        WHERE id = $7 
        RETURNING *`,
        [course_name, duration, department_id, course_code, program_level, seats, id]
    );
    return rows[0];
};

const remove = async (id) => {
    const { rows } = await pool.query(
        "DELETE FROM courses WHERE id = $1 RETURNING *",
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
