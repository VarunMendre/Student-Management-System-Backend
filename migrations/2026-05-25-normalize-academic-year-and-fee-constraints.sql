-- 1) Add normalized year column for deterministic uniqueness and querying
ALTER TABLE course_fees
ADD COLUMN normalized_year VARCHAR(20) NULL AFTER batch_id;

-- 2) Rewrite legacy component prefixes to canonical format
UPDATE course_fees
SET component_name = REGEXP_REPLACE(component_name, '^(Y4|YEAR 4|4TH|4TH YEAR|FOURTH|FOURTH YEAR)(\\s*-\\s*)', '4Y - ')
WHERE component_name REGEXP '^(Y4|YEAR 4|4TH|4TH YEAR|FOURTH|FOURTH YEAR)(\\s*-\\s*)';

UPDATE course_fees
SET component_name = REGEXP_REPLACE(component_name, '^(Y5|YEAR 5|5TH|5TH YEAR|FIFTH|FIFTH YEAR)(\\s*-\\s*)', '5Y - ')
WHERE component_name REGEXP '^(Y5|YEAR 5|5TH|5TH YEAR|FIFTH|FIFTH YEAR)(\\s*-\\s*)';

-- 3) Populate normalized_year from canonical component prefix
UPDATE course_fees
SET normalized_year = TRIM(SUBSTRING_INDEX(component_name, '-', 1))
WHERE normalized_year IS NULL OR normalized_year = '';

-- 4) Resolve generic FINAL YEAR based on course duration
UPDATE course_fees cf
JOIN course_batches cb ON cf.batch_id = cb.id
JOIN courses c ON cb.course_id = c.id
SET cf.normalized_year = CASE
    WHEN cf.normalized_year = 'FINAL YEAR' AND c.duration = '4 Years' THEN '4Y'
    WHEN cf.normalized_year = 'FINAL YEAR' AND c.duration = '5 Years' THEN '5Y'
    WHEN cf.normalized_year = 'FINAL YEAR' AND c.duration = '3 Years' THEN 'TY'
    WHEN cf.normalized_year = 'FINAL YEAR' AND c.duration = '2 Years' THEN 'SY'
    WHEN cf.normalized_year = 'FINAL YEAR' AND c.duration = '1 Year' THEN 'FY'
    ELSE cf.normalized_year
END;

-- 5) Canonical cleanups
UPDATE course_fees SET normalized_year = 'FY' WHERE normalized_year IN ('FIRST YEAR', '1ST YEAR', '1ST', 'YEAR 1');
UPDATE course_fees SET normalized_year = 'SY' WHERE normalized_year IN ('SECOND YEAR', '2ND YEAR', '2ND', 'YEAR 2');
UPDATE course_fees SET normalized_year = 'TY' WHERE normalized_year IN ('THIRD YEAR', '3RD YEAR', '3RD', 'YEAR 3');
UPDATE course_fees SET normalized_year = '4Y' WHERE normalized_year IN ('Y4', 'YEAR 4', '4TH', '4TH YEAR', 'FOURTH', 'FOURTH YEAR');
UPDATE course_fees SET normalized_year = '5Y' WHERE normalized_year IN ('Y5', 'YEAR 5', '5TH', '5TH YEAR', 'FIFTH', 'FIFTH YEAR');

-- 6) Enforce non-null and uniqueness
ALTER TABLE course_fees
MODIFY COLUMN normalized_year VARCHAR(20) NOT NULL;

ALTER TABLE course_fees
ADD CONSTRAINT uq_course_fees_batch_year_component UNIQUE (batch_id, normalized_year, component_name);

-- 7) Non-negative constraints
ALTER TABLE course_fees
ADD CONSTRAINT chk_course_fees_amount_non_negative CHECK (amount >= 0);

ALTER TABLE student_fee_ledger
ADD CONSTRAINT chk_sfl_total_yearly_fee_non_negative CHECK (total_yearly_fee >= 0),
ADD CONSTRAINT chk_sfl_total_paid_non_negative CHECK (total_paid >= 0);

ALTER TABLE fee_transactions
ADD CONSTRAINT chk_fee_transactions_amount_non_negative CHECK (amount_paid >= 0);

-- 8) Duration-aware year range constraint (MySQL 8.0.16+ check with subquery is not allowed),
-- so use trigger-based enforcement at write time.
DROP TRIGGER IF EXISTS trg_course_fees_year_validate_ins;
DROP TRIGGER IF EXISTS trg_course_fees_year_validate_upd;

DELIMITER $$
CREATE TRIGGER trg_course_fees_year_validate_ins
BEFORE INSERT ON course_fees
FOR EACH ROW
BEGIN
    DECLARE v_duration VARCHAR(20);
    SELECT c.duration INTO v_duration
    FROM course_batches cb
    JOIN courses c ON cb.course_id = c.id
    WHERE cb.id = NEW.batch_id;

    IF v_duration = '1 Year' AND NEW.normalized_year NOT IN ('FY') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid normalized_year for 1 Year course';
    ELSEIF v_duration = '2 Years' AND NEW.normalized_year NOT IN ('FY','SY') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid normalized_year for 2 Years course';
    ELSEIF v_duration = '3 Years' AND NEW.normalized_year NOT IN ('FY','SY','TY') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid normalized_year for 3 Years course';
    ELSEIF v_duration = '4 Years' AND NEW.normalized_year NOT IN ('FY','SY','TY','4Y') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid normalized_year for 4 Years course';
    ELSEIF v_duration = '5 Years' AND NEW.normalized_year NOT IN ('FY','SY','TY','4Y','5Y') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid normalized_year for 5 Years course';
    END IF;
END$$

CREATE TRIGGER trg_course_fees_year_validate_upd
BEFORE UPDATE ON course_fees
FOR EACH ROW
BEGIN
    DECLARE v_duration VARCHAR(20);
    SELECT c.duration INTO v_duration
    FROM course_batches cb
    JOIN courses c ON cb.course_id = c.id
    WHERE cb.id = NEW.batch_id;

    IF v_duration = '1 Year' AND NEW.normalized_year NOT IN ('FY') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid normalized_year for 1 Year course';
    ELSEIF v_duration = '2 Years' AND NEW.normalized_year NOT IN ('FY','SY') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid normalized_year for 2 Years course';
    ELSEIF v_duration = '3 Years' AND NEW.normalized_year NOT IN ('FY','SY','TY') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid normalized_year for 3 Years course';
    ELSEIF v_duration = '4 Years' AND NEW.normalized_year NOT IN ('FY','SY','TY','4Y') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid normalized_year for 4 Years course';
    ELSEIF v_duration = '5 Years' AND NEW.normalized_year NOT IN ('FY','SY','TY','4Y','5Y') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid normalized_year for 5 Years course';
    END IF;
END$$
DELIMITER ;
