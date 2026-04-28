import { pool } from "../config/db.js";

/**
 * Executes a function within a database transaction.
 * Automatically handles transaction start, commit, rollback, and connection release.
 * 
 * @param {Function} work - Async function receiving 'connection'
 * @returns {Promise<any>} - Result of the work
 */
export const withTransaction = async (work) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await work(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

/**
 * Helper specifically for batch processes that handle their own errors (like Scholarship)
 * but still need a transaction for each item.
 */
export const withTransactionSilent = async (work) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await work(connection);
        await connection.commit();
        return { success: true, result };
    } catch (error) {
        await connection.rollback();
        return { success: false, error };
    } finally {
        connection.release();
    }
};
