import { pool } from "../config/db.js";

const findAll = async () => {
    const [rows] = await pool.query(`
        SELECT c.*, d.name as department_name,
               COALESCE(
                 (SELECT JSON_OBJECTAGG(cat_id, details)
                  FROM (
                    SELECT 
                      course_id,
                      CASE 
                        WHEN caste_category = 'SC / ST' THEN 'scst'
                        WHEN caste_category = 'VJ / DT / NT / SBC' THEN 'vjnt'
                        WHEN caste_category = 'OBC' THEN 'obc'
                        WHEN caste_category = 'Open (EBC)' THEN 'ebc'
                        WHEN caste_category = 'OPEN' THEN 'open'
                        ELSE lower(caste_category)
                      END as cat_id,
                      JSON_OBJECT(
                        'maleGov', MAX(CASE WHEN gender = 'Male' THEN max_amount END),
                        'femaleGov', MAX(CASE WHEN gender = 'Female' THEN max_amount END)
                      ) as details
                    FROM course_scholarship_config 
                    WHERE is_active = TRUE
                    GROUP BY course_id, caste_category
                  ) sub
                  WHERE sub.course_id = c.id
                 ), JSON_OBJECT()
               ) as scholarshipStructure
        FROM courses c 
        LEFT JOIN departments d ON c.department_id = d.id 
        ORDER BY c.created_at DESC
    `);
    return rows;
};

const findById = async (id) => {
    const [rows] = await pool.query(`
        SELECT c.*, d.name as department_name,
               COALESCE(
                 (SELECT JSON_OBJECTAGG(cat_id, details)
                  FROM (
                    SELECT 
                      course_id,
                      CASE 
                        WHEN caste_category = 'SC / ST' THEN 'scst'
                        WHEN caste_category = 'VJ / DT / NT / SBC' THEN 'vjnt'
                        WHEN caste_category = 'OBC' THEN 'obc'
                        WHEN caste_category = 'Open (EBC)' THEN 'ebc'
                        WHEN caste_category = 'OPEN' THEN 'open'
                        ELSE lower(caste_category)
                      END as cat_id,
                      JSON_OBJECT(
                        'maleGov', MAX(CASE WHEN gender = 'Male' THEN max_amount END),
                        'femaleGov', MAX(CASE WHEN gender = 'Female' THEN max_amount END)
                      ) as details
                    FROM course_scholarship_config 
                    WHERE is_active = TRUE
                    GROUP BY course_id, caste_category
                  ) sub
                  WHERE sub.course_id = c.id
                 ), JSON_OBJECT()
               ) as scholarshipStructure
        FROM courses c 
        LEFT JOIN departments d ON c.department_id = d.id 
        WHERE c.id = ?
    `, [id]);
    return rows[0];
};

const create = async (data) => {
    const { course_name, duration, department_id, course_code, program_level } = data;
    const [result] = await pool.query(
        `INSERT INTO courses 
        (course_name, duration, department_id, course_code, program_level) 
        VALUES (?, ?, ?, ?, ?)`,
        [course_name, duration, department_id, course_code, program_level]
    );
    const [rows] = await pool.query("SELECT * FROM courses WHERE id = ?", [result.insertId]);
    return rows[0];
};

const update = async (id, data) => {
    const { course_name, duration, department_id, course_code, program_level } = data;
    await pool.query(
        `UPDATE courses 
        SET course_name = ?, duration = ?, department_id = ?, course_code = ?, program_level = ? 
        WHERE id = ?`,
        [course_name, duration, department_id, course_code, program_level, id]
    );
    const [rows] = await pool.query("SELECT * FROM courses WHERE id = ?", [id]);
    return rows[0];
};

const remove = async (id) => {
    const [rows] = await pool.query("SELECT * FROM courses WHERE id = ?", [id]);
    const course = rows[0];
    if (course) {
        await pool.query("DELETE FROM courses WHERE id = ?", [id]);
    }
    return course;
};

export default {
    findAll,
    findById,
    create,
    update,
    remove
};
