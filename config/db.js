import pkg from "pg";
import dotenv from "dotenv";

// Load environment variables as a fallback
dotenv.config();

const { Pool } = pkg;

// Validate essential variables
if (!process.env.PG_PASSWORD) {
  console.warn("WARNING: PG_PASSWORD is not defined in environment variables!");
}

export const pool = new Pool({
  host: process.env.PG_HOST,
  user: process.env.PG_USER,
  password: String(process.env.PG_PASSWORD || ""),
  database: process.env.PG_DATABASE,
  port: parseInt(process.env.PG_PORT || "5432", 10),
});

(async () => {
    try {
        const client = await pool.connect();
        console.log("PostgreSQL Connected Successfully");
        client.release();
    } catch (err) {
        console.error("PostgreSQL Connection Error:", err.message);
    }
})();
