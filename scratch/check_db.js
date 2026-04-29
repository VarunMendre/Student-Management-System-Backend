import { pool } from "../config/db.js";

import courseModel from "../models/courseModel.js";

async function check() {
  try {
    const course = await courseModel.findById(1);
    console.log("Course 1 Structure:", JSON.stringify(course.scholarshipStructure, null, 2));
    
    const [students] = await pool.query("SELECT id, full_name, course_id, caste_category FROM students WHERE full_name LIKE '%Shreya%'");
    console.log("Matched Students:", JSON.stringify(students, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
