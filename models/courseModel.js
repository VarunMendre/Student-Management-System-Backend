import { pool } from "../config/db.js";

const findAll = async () => {
    const { rows } = await pool.query(`
        SELECT c.*, d.name as department_name,
               coalesce(
                 (SELECT jsonb_object_agg(sub.cat_id, sub.details)
                  FROM (
                    SELECT 
                      CASE 
                        WHEN caste_category = 'SC / ST' THEN 'scst'
                        WHEN caste_category = 'VJ / DT / NT / SBC' THEN 'vjnt'
                        WHEN caste_category = 'OBC' THEN 'obc'
                        WHEN caste_category = 'Open (EBC)' THEN 'ebc'
                        WHEN caste_category = 'OPEN' THEN 'open'
                        ELSE lower(caste_category)
                      END as cat_id,
                      jsonb_build_object(
                        'maleGov', MAX(CASE WHEN gender = 'Male' THEN max_amount END),
                        'femaleGov', MAX(CASE WHEN gender = 'Female' THEN max_amount END)
                      ) as details
                    FROM course_scholarship_config 
                    WHERE course_id = c.id AND is_active = TRUE
                    GROUP BY 1
                  ) sub
                 ), '{}'::jsonb
               ) as "scholarshipStructure"
        FROM courses c 
        LEFT JOIN departments d ON c.department_id = d.id 
        ORDER BY c.created_at DESC
    `);
    return rows;
};

const findById = async (id) => {
    const { rows } = await pool.query(`
        SELECT c.*, d.name as department_name,
               coalesce(
                 (SELECT jsonb_object_agg(sub.cat_id, sub.details)
                  FROM (
                    SELECT 
                      CASE 
                        WHEN caste_category = 'SC / ST' THEN 'scst'
                        WHEN caste_category = 'VJ / DT / NT / SBC' THEN 'vjnt'
                        WHEN caste_category = 'OBC' THEN 'obc'
                        WHEN caste_category = 'Open (EBC)' THEN 'ebc'
                        WHEN caste_category = 'OPEN' THEN 'open'
                        ELSE lower(caste_category)
                      END as cat_id,
                      jsonb_build_object(
                        'maleGov', MAX(CASE WHEN gender = 'Male' THEN max_amount END),
                        'femaleGov', MAX(CASE WHEN gender = 'Female' THEN max_amount END)
                      ) as details
                    FROM course_scholarship_config 
                    WHERE course_id = c.id AND is_active = TRUE
                    GROUP BY 1
                  ) sub
                 ), '{}'::jsonb
               ) as "scholarshipStructure"
        FROM courses c 
        LEFT JOIN departments d ON c.department_id = d.id 
        WHERE c.id = $1
    `, [id]);
    return rows[0];
};

const create = async (data) => {
    const { course_name, duration, department_id, course_code, program_level } = data;
    const { rows } = await pool.query(
        `INSERT INTO courses 
        (course_name, duration, department_id, course_code, program_level) 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING *`,
        [course_name, duration, department_id, course_code, program_level]
    );
    return rows[0];
};

const update = async (id, data) => {
    const { course_name, duration, department_id, course_code, program_level } = data;
    const { rows } = await pool.query(
        `UPDATE courses 
        SET course_name = $1, duration = $2, department_id = $3, course_code = $4, program_level = $5 
        WHERE id = $6 
        RETURNING *`,
        [course_name, duration, department_id, course_code, program_level, id]
    );
    return rows[0];
};

const remove = async (id) => {
    const { rows } = await pool.query(
        "DELETE FROM courses WHERE id = $1 RETURNING *",
        [id]
    );
    return rows[0];
};

export default {
    findAll,
    findById,
    create,
    update,
    remove
};
