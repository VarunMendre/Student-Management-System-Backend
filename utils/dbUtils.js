import { pool } from "../config/db.js";

/**
 * Executes a function within a database transaction.
 * Automatically handles BEGIN, COMMIT, ROLLBACK, and Client Release.
 * 
 * @param {Function} work - Async function receiving 'client'
 * @returns {Promise<any>} - Result of the work
 */
export const withTransaction = async (work) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await work(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Helper specifically for batch processes that handle their own errors (like Scholarship)
 * but still need a transaction for each item.
 */
export const withTransactionSilent = async (work) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await work(client);
        await client.query("COMMIT");
        return { success: true, result };
    } catch (error) {
        await client.query("ROLLBACK");
        return { success: false, error };
    } finally {
        client.release();
    }
};
