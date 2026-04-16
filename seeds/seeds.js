import { pool } from "../config/db.js";

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
    const csitId = depts.rows.find((d) => d.name === "CSIT").id;
    const mgmtId = depts.rows.find((d) => d.name === "MANAGEMENT").id;

    // 2. Seed Courses
    console.log("📚 Seeding Courses...");
    const courses = [
      ["B.Tech Computer Science", "4 Years", csitId, "BCS101", "UG"],
      ["MBA Finance", "2 Years", mgmtId, "MBA202", "PG"],
    ];

    for (const course of courses) {
      await pool.query(
        `
                INSERT INTO courses (course_name, duration, department_id, course_code, program_level)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (course_code) DO NOTHING
            `,
        course,
      );
    }

    // Get Course IDs for linking batch
    const btechRes = await pool.query(
      "SELECT id FROM courses WHERE course_code = 'BCS101'",
    );
    const btechId = btechRes.rows[0].id;
    const mbaRes = await pool.query(
      "SELECT id FROM courses WHERE course_code = 'MBA202'",
    );
    const mbaId = mbaRes.rows[0].id;

    // 3. Seed Batches
    console.log("📅 Seeding Batches...");
    const batchRes = await pool.query(
      `
            INSERT INTO course_batches (course_id, batch_name, admission_year, total_seats, is_active)
            VALUES ($1, '2025 - 2029', 2025, 60, true)
            ON CONFLICT (course_id, batch_name) DO NOTHING
            RETURNING id
        `,
      [btechId],
    );

    let btechBatchId;
    if (batchRes.rows.length > 0) {
      btechBatchId = batchRes.rows[0].id;
    } else {
      const existingBatch = await pool.query(
        "SELECT id FROM course_batches WHERE course_id = $1 AND batch_name = '2025 - 2029'",
        [btechId],
      );
      btechBatchId = existingBatch.rows[0].id;
    }

    const mbaBatchRes = await pool.query(
      `
            INSERT INTO course_batches (course_id, batch_name, admission_year, total_seats, is_active)
            VALUES ($1, '2025 - 2027', 2025, 40, true)
            ON CONFLICT (course_id, batch_name) DO NOTHING
            RETURNING id
        `,
      [mbaId],
    );

    let mbaBatchId;
    if (mbaBatchRes.rows.length > 0) {
      mbaBatchId = mbaBatchRes.rows[0].id;
    } else {
      const existingBatch = await pool.query(
        "SELECT id FROM course_batches WHERE course_id = $1 AND batch_name = '2025 - 2027'",
        [mbaId],
      );
      mbaBatchId = existingBatch.rows[0].id;
    }

    // 4. Seed Fee Components (Transactional)
    console.log("💰 Seeding Fee Components...");
    const btechFees = [
      ["Tuition Fee", 85000.0],
      ["Laboratory Fee", 15000.0],
      ["Development Fee", 5000.0],
    ];
    const mbaFees = [
      ["Tuition Fee", 120000.0],
      ["Library Fee", 5000.0],
      ["Activity Fee", 5000.0],
    ];

    await pool.query("BEGIN");
    await pool.query("DELETE FROM course_fees WHERE batch_id = $1", [
      btechBatchId,
    ]);
    for (const [name, amount] of btechFees) {
      await pool.query(
        "INSERT INTO course_fees (batch_id, component_name, amount) VALUES ($1, $2, $3)",
        [btechBatchId, name, amount],
      );
    }
    await pool.query("DELETE FROM course_fees WHERE batch_id = $1", [
      mbaBatchId,
    ]);
    for (const [name, amount] of mbaFees) {
      await pool.query(
        "INSERT INTO course_fees (batch_id, component_name, amount) VALUES ($1, $2, $3)",
        [mbaBatchId, name, amount],
      );
    }
    await pool.query("COMMIT");

    // 5. Seed Sample Students
    console.log("🎓 Seeding Sample Students...");

    const sampleStudents = [
      [
        "Rahul Sharma",
        "rahul.sharma@example.com",
        "9876543210",
        "9123456789",
        null,
        null,
        csitId,
        btechId,
        btechBatchId,
        "OBC",
        "Male",
      ],
      [
        "Priya Patil",
        "priya.patil@example.com",
        "9876543211",
        "9123456788",
        "PRN2025002",
        null,
        csitId,
        btechId,
        btechBatchId,
        "General",
        "Female",
      ],
      [
        "Amit Deshmukh",
        "amit.deshmukh@example.com",
        "9876543212",
        "9123456787",
        null,
        null,
        mgmtId,
        mbaId,
        mbaBatchId,
        "SC",
        "Male",
      ],
    ];

    const enrolledStudentIds = [];

    for (const student of sampleStudents) {
      const res = await pool.query(
        `
                INSERT INTO students (full_name, email, mobile_number, alternate_number, prn_number, eligibility_number, department_id, course_id, batch_id, caste_category, gender)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (email) DO NOTHING
                RETURNING id
            `,
        student,
      );

      if (res.rows.length > 0) {
        enrolledStudentIds.push({ id: res.rows[0].id, batchId: student[8] });
      }
    }

    // 6. Seed Fee Ledger rows for enrolled students
    console.log("📒 Seeding Fee Ledger...");
    const btechYears = ["FY", "SY", "TY", "Final Year"];
    const mbaYears = ["FY", "Final Year"];

    for (const student of enrolledStudentIds) {
      // Get total yearly fee for this batch
      const feeRes = await pool.query(
        "SELECT COALESCE(SUM(amount), 0) as total_fee FROM course_fees WHERE batch_id = $1",
        [student.batchId],
      );
      const yearlyFee = parseFloat(feeRes.rows[0].total_fee);
      const years = student.batchId === btechBatchId ? btechYears : mbaYears;

      for (let i = 0; i < years.length; i++) {
        await pool.query(
          `
                    INSERT INTO student_fee_ledger (student_id, academic_year, academic_year_num, total_yearly_fee)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (student_id, academic_year_num) DO NOTHING
                `,
          [student.id, years[i], i + 1, yearlyFee],
        );
      }
    }

    // 7. Seed a sample payment for Rahul (first student)
    console.log("💳 Seeding Sample Payments...");
    if (enrolledStudentIds.length > 0) {
      const rahulId = enrolledStudentIds[0].id;
      const ledgerRes = await pool.query(
        "SELECT id FROM student_fee_ledger WHERE student_id = $1 AND academic_year_num = 1",
        [rahulId],
      );

      if (ledgerRes.rows.length > 0) {
        const ledgerId = ledgerRes.rows[0].id;

        // Check if a sample payment already exists
        const existingTxn = await pool.query(
          "SELECT id FROM fee_transactions WHERE student_id = $1 LIMIT 1",
          [rahulId],
        );

        if (existingTxn.rows.length === 0) {
          const receiptNumber = `RCP-20260410-0001`;
          await pool.query(
            `
                        INSERT INTO fee_transactions (student_id, ledger_id, amount_paid, payment_mode, payment_reference, receipt_number, remarks, transaction_date, created_by)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    `,
            [
              rahulId,
              ledgerId,
              25000.0,
              "UPI",
              "UTR987654321",
              receiptNumber,
              "First installment FY",
              "2026-04-10",
              "admin",
            ],
          );

          // Update ledger
          await pool.query(
            "UPDATE student_fee_ledger SET total_paid = 25000.00, status = 'Partial' WHERE id = $1",
            [ledgerId],
          );
        }
      }
    }

    console.log("\n✅ DATABASE SEEDED SUCCESSFULLY!");
    console.log("Summary:");
    console.log("- 3 Departments created");
    console.log("- 2 Courses created (BCS101, MBA202)");
    console.log("- 2 Batches created (2025-2029, 2025-2027)");
    console.log("- Fee components linked (B.Tech: ₹105,000 | MBA: ₹130,000)");
    console.log("- 3 Sample students enrolled");
    console.log("- Fee ledger auto-populated for all students");
    console.log("- 1 Sample payment recorded (Rahul - ₹25,000 FY)");
  } catch (error) {
    await pool.query("ROLLBACK").catch(() => {});
    console.error("❌ SEEDING FAILED:", error.message);
  } finally {
    process.exit();
  }
};

seedDatabase();
