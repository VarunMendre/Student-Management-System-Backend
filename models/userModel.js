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
    const [rows] = await pool.query(
        `SELECT ${DEFAULT_USER_COLUMNS}, password
         FROM app_users
         WHERE email = ?`,
        [email]
    );
    return rows[0] || null;
};

const findByEmailExcludingId = async (email, id) => {
    const [rows] = await pool.query(
        `SELECT ${DEFAULT_USER_COLUMNS}
         FROM app_users
         WHERE email = ? AND id <> ?`,
        [email, id]
    );
    return rows[0] || null;
};

const findById = async (id) => {
    const [rows] = await pool.query(
        `SELECT ${DEFAULT_USER_COLUMNS}
         FROM app_users
         WHERE id = ?`,
        [id]
    );
    return rows[0] || null;
};

const findByIdWithPassword = async (id) => {
    const [rows] = await pool.query(
        `SELECT ${DEFAULT_USER_COLUMNS}, password
         FROM app_users
         WHERE id = ?`,
        [id]
    );
    return rows[0] || null;
};

const updateRefreshToken = async (userId, token) => {
    await pool.query(
        `UPDATE app_users
         SET refresh_token = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [token, userId]
    );
    return findById(userId);
};

const createUser = async ({ name, email, password, contact_number, role }) => {
    const [result] = await pool.query(
        `INSERT INTO app_users (name, email, password, contact_number, role, is_password_changed)
         VALUES (?, ?, ?, ?, ?, FALSE)`,
        [name, email, password, contact_number, role]
    );
    return findById(result.insertId);
};

const createStudentUser = async (connection, { name, email, password, contact_number, role, student_id, is_password_changed = false }) => {
    // Note: mysql2/promise connection uses query the same way as pool
    const [result] = await connection.query(
        `INSERT INTO app_users (name, email, password, contact_number, role, student_id, is_password_changed)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, email, password, contact_number, role, student_id, is_password_changed]
    );
    
    const [rows] = await connection.query(
        `SELECT ${DEFAULT_USER_COLUMNS} FROM app_users WHERE id = ?`,
        [result.insertId]
    );
    return rows[0];
};

const getAllStaffUsers = async () => {
    const [rows] = await pool.query(
        `SELECT id, name, email, contact_number, role, is_active, is_password_changed,
                (refresh_token IS NOT NULL) AS is_online, created_at, updated_at
         FROM app_users
         WHERE role <> 'student'
         ORDER BY created_at DESC`
    );
    return rows;
};

const updateRole = async (id, role) => {
    await pool.query(
        `UPDATE app_users
         SET role = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [role, id]
    );
    
    const [rows] = await pool.query(
        `SELECT id, name, email, contact_number, role, is_active, is_password_changed,
                (refresh_token IS NOT NULL) AS is_online, created_at, updated_at
         FROM app_users
         WHERE id = ?`,
        [id]
    );
    return rows[0] || null;
};

const setActiveStatus = async (id, status) => {
    await pool.query(
        `UPDATE app_users
         SET is_active = ?,
             refresh_token = CASE WHEN ? THEN refresh_token ELSE NULL END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, status, id]
    );
    
    const [rows] = await pool.query(
        `SELECT id, name, email, contact_number, role, is_active, is_password_changed,
                (refresh_token IS NOT NULL) AS is_online, created_at, updated_at
         FROM app_users
         WHERE id = ?`,
        [id]
    );
    return rows[0] || null;
};

const deleteById = async (id) => {
    // MySQL delete doesn't return columns, so we fetch then delete
    const [rows] = await pool.query(
        `SELECT id, name, email, role FROM app_users WHERE id = ?`,
        [id]
    );
    const user = rows[0] || null;
    if (user) {
        await pool.query(`DELETE FROM app_users WHERE id = ?`, [id]);
    }
    return user;
};

const updatePassword = async (id, hashedPassword) => {
    await pool.query(
        `UPDATE app_users
         SET password = ?,
             is_password_changed = TRUE,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [hashedPassword, id]
    );
    return findById(id);
};

const updateProfile = async (id, { name, email, contact_number }) => {
    await pool.query(
        `UPDATE app_users
         SET name = ?,
             email = ?,
             contact_number = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name, email, contact_number, id]
    );
    return findById(id);
};

const updateStudentPasswordChangedStatus = async (studentId, status = true) => {
    if (!studentId) return null;

    await pool.query(
        `UPDATE students
         SET is_password_changed = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, studentId]
    );
    
    const [rows] = await pool.query(
        `SELECT id, is_password_changed FROM students WHERE id = ?`,
        [studentId]
    );
    return rows[0] || null;
};

const updateStudentLinkedAccount = async (connection, studentId, { name, email, contact_number }) => {
    const updates = [];
    const values = [];

    if (name !== undefined) {
        updates.push(`name = ?`);
        values.push(name);
    }
    if (email !== undefined) {
        updates.push(`email = ?`);
        values.push(email);
    }
    if (contact_number !== undefined) {
        updates.push(`contact_number = ?`);
        values.push(contact_number);
    }

    if (!updates.length) {
        return null;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    // studentId for the WHERE clause
    values.push(studentId);

    await connection.query(
        `UPDATE app_users
         SET ${updates.join(", ")}
         WHERE student_id = ?`,
        values
    );
    
    const [rows] = await connection.query(
        `SELECT ${DEFAULT_USER_COLUMNS} FROM app_users WHERE student_id = ?`,
        [studentId]
    );
    return rows[0] || null;
};

export default {
    findByEmail,
    findByEmailExcludingId,
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
    updateProfile,
    updateStudentPasswordChangedStatus,
    updateStudentLinkedAccount
};
