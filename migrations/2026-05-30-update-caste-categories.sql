-- Caste Categories Database Migration Script

-- 1. Pre-align the categories to prevent validation/check constraint failures during ALTER
UPDATE students 
SET caste_category = 'OPEN' 
WHERE caste_category IN ('General', 'EWS', 'OPEN');

UPDATE students 
SET caste_category = 'EBC' 
WHERE caste_category = 'EBC';

UPDATE students 
SET caste_category = 'SC/ST' 
WHERE caste_category IN ('SC', 'ST', 'SC/ST');

UPDATE students 
SET caste_category = 'VJNT' 
WHERE caste_category IN ('SBC', 'VJ', 'NT-A', 'NT-B', 'NT-C', 'NT-D', 'VJNT');

-- Same mapping for course_scholarship_config if exists
UPDATE course_scholarship_config 
SET caste_category = 'OPEN' 
WHERE caste_category IN ('General', 'EWS', 'OPEN');

UPDATE course_scholarship_config 
SET caste_category = 'EBC' 
WHERE caste_category = 'EBC';

UPDATE course_scholarship_config 
SET caste_category = 'SC/ST' 
WHERE caste_category IN ('SC', 'ST', 'SC/ST');

UPDATE course_scholarship_config 
SET caste_category = 'VJNT' 
WHERE caste_category IN ('SBC', 'VJ', 'NT-A', 'NT-B', 'NT-C', 'NT-D', 'VJNT');

-- 2. Modify caste_category columns to the new ENUM definitions
ALTER TABLE students 
  MODIFY COLUMN caste_category ENUM('SC/ST', 'VJNT', 'OBC', 'EBC', 'OPEN') NOT NULL;

ALTER TABLE course_scholarship_config 
  MODIFY COLUMN caste_category ENUM('SC/ST', 'VJNT', 'OBC', 'EBC', 'OPEN') NOT NULL;
