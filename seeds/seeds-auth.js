import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";

const seedPrincipal = async () => {
  try {
    const hashedPassword = await bcrypt.hash("Principal@123", 12);

    await pool.query(
      `INSERT INTO app_users (name, email, password, contact_number, role, is_active, is_password_changed)
             VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
             ON CONFLICT (email) DO UPDATE
             SET name = EXCLUDED.name,
                 contact_number = EXCLUDED.contact_number,
                 role = EXCLUDED.role,
                 password = EXCLUDED.password,
                 is_active = TRUE,
                 is_password_changed = TRUE,
                 updated_at = CURRENT_TIMESTAMP`,
      [
        "Principal",
        "principal@asm.edu.in",
        hashedPassword,
        "9000000000",
        "principal",
      ],
    );

    console.log("Principal auth seed completed");
  } catch (error) {
    console.error("Principal auth seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

seedPrincipal();
