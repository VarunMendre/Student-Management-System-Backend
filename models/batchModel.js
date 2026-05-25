import { pool } from "../config/db.js";

const create = async (data) => {
    const { course_id, batch_name, admission_year, total_seats } = data;
    const [result] = await pool.query(
        "INSERT INTO course_batches (course_id, batch_name, admission_year, total_seats) VALUES (?, ?, ?, ?)",
        [course_id, batch_name, admission_year, total_seats]
    );
    const [rows] = await pool.query("SELECT * FROM course_batches WHERE id = ?", [result.insertId]);
    return rows[0];
};

const deleteFeesByBatch = async (connection, batchId) => {
    await connection.query("DELETE FROM course_fees WHERE batch_id = ?", [batchId]);
};

const insertFee = async (connection, batchId, normalized_year, component_name, amount) => {
    try {
        await connection.query(
            "INSERT INTO course_fees (batch_id, normalized_year, component_name, amount) VALUES (?, ?, ?, ?)",
            [batchId, normalized_year, component_name, amount]
        );
    } catch (error) {
        // Backward compatibility for databases where normalized_year column is not migrated yet.
        if (error?.code === "ER_BAD_FIELD_ERROR" || String(error?.message || "").includes("Unknown column 'normalized_year'")) {
            await connection.query(
                "INSERT INTO course_fees (batch_id, component_name, amount) VALUES (?, ?, ?)",
                [batchId, component_name, amount]
            );
            return;
        }
        throw error;
    }
};

const findBatchById = async (batchId) => {
    const [rows] = await pool.query(
        `SELECT cb.*, c.duration
         FROM course_batches cb
         JOIN courses c ON cb.course_id = c.id
         WHERE cb.id = ?`,
        [batchId]
    );
    return rows[0];
};

const findFeesByBatchWithTotal = async (batchId) => {
    // MySQL 8.0 support window functions. 
    // Note: phpMyAdmin/MySQL might be older or in a mode where OVER() needs special handling, but usually it's fine.
    const [rows] = await pool.query(
        `SELECT id, component_name, amount, SUM(amount) OVER() as total_fee 
         FROM course_fees WHERE batch_id = ?`,
        [batchId]
    );
    return rows;
};

const findAllWithCourseDetails = async (courseId = null) => {
    const values = [];
    let query = `
        SELECT cb.*, c.course_name, d.name as department_name,
               COALESCE(SUM(cf.amount), 0) as total_fee
        FROM course_batches cb
        JOIN courses c ON cb.course_id = c.id
        JOIN departments d ON c.department_id = d.id
        LEFT JOIN course_fees cf ON cb.id = cf.batch_id
    `;

    if (courseId) {
        query += " WHERE cb.course_id = ?";
        values.push(courseId);
    }

    query += " GROUP BY cb.id, c.course_name, d.name ORDER BY cb.admission_year DESC";

    const [rows] = await pool.query(query, values);
    return rows;
};

export default {
    create,
    deleteFeesByBatch,
    insertFee,
    findBatchById,
    findFeesByBatchWithTotal,
    findAllWithCourseDetails
};
