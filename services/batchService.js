import { pool } from "../config/db.js";

const createBatch = async (batchData) => {
    const { course_id, batch_name, admission_year, total_seats } = batchData;
    const { rows } = await pool.query(
        "INSERT INTO course_batches (course_id, batch_name, admission_year, total_seats) VALUES ($1, $2, $3, $4) RETURNING *",
        [course_id, batch_name, admission_year, total_seats]
    );

    return rows[0];
}

const updateBatchFees = async (batchId, components) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. Delete all current components for this batch
        await client.query("DELETE FROM course_fees WHERE batch_id = $1", [batchId]);
        // 2. Insert the fresh components
        const insertQuery = "INSERT INTO course_fees (batch_id, component_name, amount) VALUES ($1, $2, $3)";
        for (const comp of components) {
            await client.query(insertQuery, [batchId, comp.component_name, comp.amount]);
        }
        await client.query("COMMIT");
        return { success: true };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const getBatchWithFees = async (batchId) => {
    // Fetch batch details
    const batchRes = await pool.query("SELECT * FROM course_batches WHERE id = $1", [batchId]);
    if (batchRes.rows.length === 0) return null;
    // Fetch components and use Window function to calculate total sum in one query
    const feesRes = await pool.query(
        `SELECT id, component_name, amount, SUM(amount) OVER() as total_fee 
         FROM course_fees WHERE batch_id = $1`,
        [batchId]
    );
    const batch = batchRes.rows[0];
    const components = feesRes.rows;
    // Extract total from first row if exists
    const total_fee = components.length > 0 ? parseFloat(components[0].total_fee) : 0;
    return {
        ...batch,
        components: components.map(({ total_fee, ...rest }) => rest),
        total_fee
    };
};

export default { createBatch, updateBatchFees, getBatchWithFees };