import { pool } from "../config/db.js";
import { formatCourseDuration, parseCourseDurationYears } from "../utils/courseDuration.js";

const normalizeCourseRow = (row) => ({
    ...row,
    duration: formatCourseDuration(row?.duration),
    duration_years: parseCourseDurationYears(row?.duration, 3)
});

const findAll = async () => {
    const [rows] = await pool.query(`
        SELECT c.*, d.name as department_name,
               COALESCE(
                 (SELECT JSON_OBJECTAGG(cat_id, details)
                  FROM (
                    SELECT 
                      course_id,
                      CASE 
                        WHEN caste_category IN ('SC', 'ST', 'SC / ST', 'SC/ST') THEN 'scst'
                        WHEN caste_category IN ('VJ', 'NT-A', 'NT-B', 'NT-C', 'NT-D', 'SBC', 'VJ / DT / NT / SBC', 'VJNT') THEN 'vjnt'
                        WHEN caste_category = 'OBC' THEN 'obc'
                        WHEN caste_category IN ('EWS', 'EBC', 'OPEN') THEN 'general'
                        WHEN caste_category = 'General' THEN 'general'
                        ELSE lower(caste_category)
                      END as cat_id,
                      JSON_OBJECT(
                        'maleGov', MAX(CASE WHEN gender = 'Male' THEN max_amount END),
                        'femaleGov', MAX(CASE WHEN gender = 'Female' THEN max_amount END)
                      ) as details
                    FROM course_scholarship_config 
                    WHERE is_active = TRUE
                    GROUP BY course_id, cat_id
                  ) sub
                  WHERE sub.course_id = c.id
                 ), JSON_OBJECT()
               ) as scholarshipStructure
        FROM courses c 
        LEFT JOIN departments d ON c.department_id = d.id 
        ORDER BY c.created_at DESC
    `);
    return rows.map(row => normalizeCourseRow({
        ...row,
        scholarshipStructure: typeof row.scholarshipStructure === 'string'
            ? JSON.parse(row.scholarshipStructure)
            : (row.scholarshipStructure || {})
    }));
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
                        WHEN caste_category IN ('SC', 'ST', 'SC / ST', 'SC/ST') THEN 'scst'
                        WHEN caste_category IN ('VJ', 'NT-A', 'NT-B', 'NT-C', 'NT-D', 'SBC', 'VJ / DT / NT / SBC', 'VJNT') THEN 'vjnt'
                        WHEN caste_category = 'OBC' THEN 'obc'
                        WHEN caste_category IN ('EWS', 'EBC', 'OPEN') THEN 'general'
                        WHEN caste_category = 'General' THEN 'general'
                        ELSE lower(caste_category)
                      END as cat_id,
                      JSON_OBJECT(
                        'maleGov', MAX(CASE WHEN gender = 'Male' THEN max_amount END),
                        'femaleGov', MAX(CASE WHEN gender = 'Female' THEN max_amount END)
                      ) as details
                    FROM course_scholarship_config 
                    WHERE is_active = TRUE
                    GROUP BY course_id, cat_id
                  ) sub
                  WHERE sub.course_id = c.id
                 ), JSON_OBJECT()
               ) as scholarshipStructure
        FROM courses c 
        LEFT JOIN departments d ON c.department_id = d.id 
        WHERE c.id = ?
    `, [id]);
    if (!rows[0]) return null;
    return normalizeCourseRow({
        ...rows[0],
        scholarshipStructure: typeof rows[0].scholarshipStructure === 'string'
            ? JSON.parse(rows[0].scholarshipStructure)
            : (rows[0].scholarshipStructure || {})
    });
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
    return normalizeCourseRow(rows[0]);
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
    return normalizeCourseRow(rows[0]);
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
