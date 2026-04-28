import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";

const seedPrincipal = async () => {
  try {
    const hashedPassword = await bcrypt.hash("principal@123", 12);

    await pool.query(
      `INSERT INTO app_users (name, email, password, contact_number, role, is_active, is_password_changed)
             VALUES (?, ?, ?, ?, ?, TRUE, TRUE)
             ON DUPLICATE KEY UPDATE
                 name = VALUES(name),
                 contact_number = VALUES(contact_number),
                 role = VALUES(role),
                 password = VALUES(password),
                 is_active = TRUE,
                 is_password_changed = TRUE,
                 updated_at = CURRENT_TIMESTAMP`,
      [
        "Principal",
        "principal@gmail.com",
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
