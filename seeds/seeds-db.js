import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stripLeadingSqlComments = (query) => {
  const lines = String(query || "").split("\n");
  let firstStatementLineIndex = 0;

  while (firstStatementLineIndex < lines.length) {
    const line = lines[firstStatementLineIndex].trim();

    if (!line || line.startsWith("--")) {
      firstStatementLineIndex += 1;
      continue;
    }

    break;
  }

  return lines.slice(firstStatementLineIndex).join("\n").trim();
};

const isDuplicateIndexError = (error, query) => {
  const normalizedQuery = stripLeadingSqlComments(query).toUpperCase();
  return normalizedQuery.startsWith("CREATE INDEX") && error?.code === "ER_DUP_KEYNAME";
};

const initializeDatabase = async () => {
  try {
    console.log("Reading schema.sql...");
    const schemaPath = path.join(__dirname, "..", "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    // Split the schema by semicolon to run queries individually
    // This handles the lack of multipleStatements support in mysql2 by default
    const queries = schema
      .split(";")
      .map(query => query.trim())
      .filter(query => query.length > 0);

    console.log(`Executing ${queries.length} queries from schema.sql...`);
    
    const connection = await pool.getConnection();
    try {
        for (let i = 0; i < queries.length; i++) {
            try {
                await connection.query(queries[i]);
            } catch (queryErr) {
                if (isDuplicateIndexError(queryErr, queries[i])) {
                    console.warn(`Skipping existing index in query #${i + 1}`);
                    continue;
                }

                console.error(`Error in query #${i + 1}:`, queries[i]);
                throw queryErr;
            }
        }
    } finally {
        connection.release();
    }

    console.log("Database initialized successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error initializing database:", err.message);
    process.exit(1);
  }
};

initializeDatabase();
