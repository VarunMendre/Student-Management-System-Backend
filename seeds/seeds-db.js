import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const initializeDatabase = async () => {
  try {
    console.log("Reading schema.sql...");
    const schemaPath = path.join(__dirname, "..", "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    console.log("Executing schema.sql...");
    await pool.query(schema);

    console.log("Database initialized successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error initializing database:", err.message);
    process.exit(1);
  }
};

initializeDatabase();
