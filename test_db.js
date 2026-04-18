import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'student_management',
  password: 'admin', // assuming default local password
  port: 5432,
});

async function run() {
  const batches = await pool.query('SELECT * FROM course_batches');
  console.log("Batches in DB:", batches.rows);

  const fees = await pool.query('SELECT * FROM course_fees');
  console.log("Fees in DB:", fees.rows);

  const courses = await pool.query('SELECT * FROM courses');
  console.log("Courses in DB:", courses.rows);

  process.exit(0);
}

run().catch(console.error);
