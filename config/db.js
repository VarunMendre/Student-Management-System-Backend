import mysql from "mysql2/promise";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Validate essential variables
if (!process.env.MYSQL_PASSWORD) {
  console.warn("WARNING: MYSQL_PASSWORD is not defined in environment variables!");
}

// Create the connection pool
export const pool = mysql.createPool({
  host: process.env.MYSQL_HOSTNAME,
  user: process.env.MYSQL_USERNAME,
  password: String(process.env.MYSQL_PASSWORD || ""),
  database: process.env.MYSQL_DB,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 20),
  maxIdle: Number(process.env.DB_MAX_IDLE || 10),
  idleTimeout: Number(process.env.DB_IDLE_TIMEOUT_MS || 60000),
  queueLimit: Number(process.env.DB_QUEUE_LIMIT || 100),
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Test the connection
(async () => {
    try {
        const connection = await pool.getConnection();
        console.log("MySQL Connected Successfully (phpMyAdmin)");
        connection.release();
    } catch (err) {
        console.error("MySQL Connection Error:", err.message);
    }
})();
 
