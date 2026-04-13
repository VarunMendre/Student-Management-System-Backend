import batchModel from "../models/batchModel.js";
import { withTransaction } from "../utils/dbUtils.js";
import { pool } from "../config/db.js";

const createBatch = async (batchData) => {
    return await batchModel.create(batchData);
};

const updateBatchFees = async (batchId, components) => {
    return await withTransaction(async (client) => {
        await batchModel.deleteFeesByBatch(client, batchId);
        for (const comp of components) {
            await batchModel.insertFee(client, batchId, comp.component_name, comp.amount);
        }
        return { success: true };
    });
};

const getBatchWithFees = async (batchId) => {
    const batch = await batchModel.findBatchById(batchId);
    if (!batch) return null;

    const components = await batchModel.findFeesByBatchWithTotal(batchId);
    const total_fee = components.length > 0 ? parseFloat(components[0].total_fee) : 0;
    
    return {
        ...batch,
        components: components.map(({ total_fee, ...rest }) => rest),
        total_fee
    };
};

const getAllBatches = async (courseId) => {
    let query = `
        SELECT cb.*, c.course_name, d.name as department_name,
               COALESCE(SUM(cf.amount), 0) as total_fee
        FROM course_batches cb
        JOIN courses c ON cb.course_id = c.id
        JOIN departments d ON c.department_id = d.id
        LEFT JOIN course_fees cf ON cb.id = cf.batch_id
    `;
    const params = [];
    if (courseId) {
        query += " WHERE cb.course_id = $1";
        params.push(courseId);
    }
    query += " GROUP BY cb.id, c.course_name, d.name ORDER BY cb.admission_year DESC";
    
    const { rows } = await pool.query(query, params);
    return rows;
};

export default { createBatch, updateBatchFees, getBatchWithFees, getAllBatches };