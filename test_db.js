import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOSTNAME,
  user: process.env.MYSQL_USERNAME,
  password: String(process.env.MYSQL_PASSWORD || ""),
  database: process.env.MYSQL_DB,
});

async function run() {
  console.log("Testing MySQL Connection...");
  
  const [batches] = await pool.query('SELECT * FROM course_batches');
  console.log("Batches in DB:", batches);

  const [fees] = await pool.query('SELECT * FROM course_fees');
  console.log("Fees in DB:", fees);

  const [courses] = await pool.query('SELECT * FROM courses');
  console.log("Courses in DB:", courses);

  process.exit(0);
}

run().catch(err => {
    console.error("Test Failed:", err.message);
    process.exit(1);
});
