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
  connectionLimit: 10,
  queueLimit: 0,
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
