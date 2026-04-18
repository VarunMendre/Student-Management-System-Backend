import { pool } from "../config/db.js";

const create = async (data) => {
    const { course_id, batch_name, admission_year, total_seats } = data;
    const { rows } = await pool.query(
        "INSERT INTO course_batches (course_id, batch_name, admission_year, total_seats) VALUES ($1, $2, $3, $4) RETURNING *",
        [course_id, batch_name, admission_year, total_seats]
    );
    return rows[0];
};

const deleteFeesByBatch = async (client, batchId) => {
    await client.query("DELETE FROM course_fees WHERE batch_id = $1", [batchId]);
};

const insertFee = async (client, batchId, component_name, amount) => {
    await client.query(
        "INSERT INTO course_fees (batch_id, component_name, amount) VALUES ($1, $2, $3)",
        [batchId, component_name, amount]
    );
};

const findBatchById = async (batchId) => {
    const { rows } = await pool.query("SELECT * FROM course_batches WHERE id = $1", [batchId]);
    return rows[0];
};

const findFeesByBatchWithTotal = async (batchId) => {
    const res = await pool.query(
        `SELECT id, component_name, amount, SUM(amount) OVER() as total_fee 
         FROM course_fees WHERE batch_id = $1`,
        [batchId]
    );
    return res.rows;
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
        query += " WHERE cb.course_id = $1";
        values.push(courseId);
    }

    query += " GROUP BY cb.id, c.course_name, d.name ORDER BY cb.admission_year DESC";

    const { rows } = await pool.query(query, values);
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
