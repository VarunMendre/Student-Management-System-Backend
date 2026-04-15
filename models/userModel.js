import { pool } from "../config/db.js";

const DEFAULT_USER_COLUMNS = `
    id,
    name,
    email,
    contact_number,
    role,
    student_id,
    is_active,
    is_password_changed,
    refresh_token,
    created_at,
    updated_at
`;

const findByEmail = async (email) => {
    const { rows } = await pool.query(
        `SELECT ${DEFAULT_USER_COLUMNS}, password
         FROM app_users
         WHERE email = $1`,
        [email]
    );
    return rows[0] || null;
};

const findById = async (id) => {
    const { rows } = await pool.query(
        `SELECT ${DEFAULT_USER_COLUMNS}
         FROM app_users
         WHERE id = $1`,
        [id]
    );
    return rows[0] || null;
};

const findByIdWithPassword = async (id) => {
    const { rows } = await pool.query(
        `SELECT ${DEFAULT_USER_COLUMNS}, password
         FROM app_users
         WHERE id = $1`,
        [id]
    );
    return rows[0] || null;
};

const updateRefreshToken = async (userId, token) => {
    const { rows } = await pool.query(
        `UPDATE app_users
         SET refresh_token = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING ${DEFAULT_USER_COLUMNS}`,
        [userId, token]
    );
    return rows[0] || null;
};

const createUser = async ({ name, email, password, contact_number, role }) => {
    const { rows } = await pool.query(
        `INSERT INTO app_users (name, email, password, contact_number, role, is_password_changed)
         VALUES ($1, $2, $3, $4, $5, FALSE)
         RETURNING ${DEFAULT_USER_COLUMNS}`,
        [name, email, password, contact_number, role]
    );
    return rows[0];
};

const createStudentUser = async (client, { name, email, password, contact_number, role, student_id, is_password_changed = false }) => {
    const { rows } = await client.query(
        `INSERT INTO app_users (name, email, password, contact_number, role, student_id, is_password_changed)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${DEFAULT_USER_COLUMNS}`,
        [name, email, password, contact_number, role, student_id, is_password_changed]
    );
    return rows[0];
};

const getAllStaffUsers = async () => {
    const { rows } = await pool.query(
        `SELECT id, name, email, contact_number, role, is_active, is_password_changed,
                (refresh_token IS NOT NULL) AS is_online, created_at, updated_at
         FROM app_users
         WHERE role <> 'student'
         ORDER BY created_at DESC`
    );
    return rows;
};

const updateRole = async (id, role) => {
    const { rows } = await pool.query(
        `UPDATE app_users
         SET role = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, name, email, contact_number, role, is_active, is_password_changed,
                   (refresh_token IS NOT NULL) AS is_online, created_at, updated_at`,
        [id, role]
    );
    return rows[0] || null;
};

const setActiveStatus = async (id, status) => {
    const { rows } = await pool.query(
        `UPDATE app_users
         SET is_active = $2,
             refresh_token = CASE WHEN $2 THEN refresh_token ELSE NULL END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, name, email, contact_number, role, is_active, is_password_changed,
                   (refresh_token IS NOT NULL) AS is_online, created_at, updated_at`,
        [id, status]
    );
    return rows[0] || null;
};

const deleteById = async (id) => {
    const { rows } = await pool.query(
        `DELETE FROM app_users
         WHERE id = $1
         RETURNING id, name, email, role`,
        [id]
    );
    return rows[0] || null;
};

const updatePassword = async (id, hashedPassword) => {
    const { rows } = await pool.query(
        `UPDATE app_users
         SET password = $2,
             is_password_changed = TRUE,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING ${DEFAULT_USER_COLUMNS}`,
        [id, hashedPassword]
    );
    return rows[0] || null;
};

const updateStudentPasswordChangedStatus = async (studentId, status = true) => {
    if (!studentId) return null;

    const { rows } = await pool.query(
        `UPDATE students
         SET is_password_changed = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, is_password_changed`,
        [studentId, status]
    );
    return rows[0] || null;
};

export default {
    findByEmail,
    findById,
    findByIdWithPassword,
    updateRefreshToken,
    createUser,
    createStudentUser,
    getAllStaffUsers,
    updateRole,
    setActiveStatus,
    deleteById,
    updatePassword,
    updateStudentPasswordChangedStatus
};
