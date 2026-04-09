import { pool } from "./config/db.js";

const seedDatabase = async () => {
    console.log("🌱 Starting Master Database Seeding...");

    try {
        // 1. Seed Departments
        console.log("🏢 Seeding Departments...");
        await pool.query(`
            INSERT INTO departments (name) 
            VALUES ('CSIT'), ('MANAGEMENT'), ('COMMERCE')
            ON CONFLICT DO NOTHING
        `);

        // Get IDs for linking
        const depts = await pool.query("SELECT id, name FROM departments");
        const csitId = depts.rows.find(d => d.name === 'CSIT').id;
        const mgmtId = depts.rows.find(d => d.name === 'MANAGEMENT').id;

        // 2. Seed Courses
        console.log("📚 Seeding Courses...");
        const courses = [
            ['B.Tech Computer Science', '4 Years', csitId, 'BCS101', 'UG'],
            ['MBA Finance', '2 Years', mgmtId, 'MBA202', 'PG']
        ];

        for (const course of courses) {
            await pool.query(`
                INSERT INTO courses (course_name, duration, department_id, course_code, program_level)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (course_code) DO NOTHING
            `, course);
        }

        // Get Course ID for linking batch
        const courseRes = await pool.query("SELECT id FROM courses WHERE course_code = 'BCS101'");
        const btechId = courseRes.rows[0].id;

        // 3. Seed Batch
        console.log("📅 Seeding Batch...");
        const batchRes = await pool.query(`
            INSERT INTO course_batches (course_id, batch_name, admission_year, total_seats, is_active)
            VALUES ($1, '2025 - 2029', 2025, 60, true)
            ON CONFLICT (course_id, batch_name) DO NOTHING
            RETURNING id
        `, [btechId]);

        // If batch already existed and wasn't returned, fetch its ID
        let batchId;
        if (batchRes.rows.length > 0) {
            batchId = batchRes.rows[0].id;
        } else {
            const existingBatch = await pool.query(
                "SELECT id FROM course_batches WHERE course_id = $1 AND batch_name = '2025 - 2029'",
                [btechId]
            );
            batchId = existingBatch.rows[0].id;
        }

        // 4. Seed Fee Components (Transactional)
        console.log("💰 Seeding Fee Components...");
        const fees = [
            ['Tuition Fee', 85000.00],
            ['Laboratory Fee', 15000.00],
            ['Development Fee', 5000.00]
        ];

        await pool.query("BEGIN");
        // Clear old fees for this specific batch to avoid duplicates during seeding
        await pool.query("DELETE FROM course_fees WHERE batch_id = $1", [batchId]);

        for (const [name, amount] of fees) {
            await pool.query(
                "INSERT INTO course_fees (batch_id, component_name, amount) VALUES ($1, $2, $3)",
                [batchId, name, amount]
            );
        }
        await pool.query("COMMIT");

        console.log("\n✅ DATABASE SEEDED SUCCESSFULLY!");
        console.log("Summary:");
        console.log("- 3 Departments created");
        console.log("- 2 Courses created (BCS101, MBA202)");
        console.log("- 1 Batch created (2025-2029)");
        console.log("- 3 Fee components linked (Total: ₹105,000.00)");

    } catch (error) {
        await pool.query("ROLLBACK").catch(() => { });
        console.error("❌ SEEDING FAILED:", error.message);
    } finally {
        process.exit();
    }
};

seedDatabase();
