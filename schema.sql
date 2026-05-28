-- Schema for Student Management System (MySQL/phpMyAdmin compatible)

-- Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Courses Table
CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_name VARCHAR(100) NOT NULL,
    duration ENUM('1 Year', '2 Years', '3 Years', '4 Years', '5 Years'),
    department_id INTEGER,
    course_code VARCHAR(20) UNIQUE,
    program_level ENUM('UG', 'PG'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);

-- Course Batches Table 
CREATE TABLE IF NOT EXISTS course_batches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INTEGER,
    batch_name VARCHAR(50) NOT NULL,
    admission_year INTEGER NOT NULL,
    total_seats INTEGER NOT NULL DEFAULT 0, 
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, batch_name),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);


-- Table to store the breakdown of fees for a specific batch
CREATE TABLE IF NOT EXISTS course_fees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id INTEGER,
    normalized_year VARCHAR(20) NOT NULL,
    component_name VARCHAR(100) NOT NULL, 
    amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),       
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(batch_id, normalized_year, component_name),
    FOREIGN KEY (batch_id) REFERENCES course_batches(id) ON DELETE CASCADE
);

-- Students Table (Enrollment Record)
CREATE TABLE IF NOT EXISTS students (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    full_name           VARCHAR(150) NOT NULL,
    email               VARCHAR(150) UNIQUE NOT NULL,
    mobile_number       VARCHAR(15) NOT NULL,
    alternate_number    VARCHAR(15) NOT NULL,
    prn_number          VARCHAR(50) DEFAULT NULL,
    eligibility_number  VARCHAR(50) DEFAULT NULL,
    department_id       INTEGER NOT NULL,
    course_id           INTEGER NOT NULL,
    batch_id            INTEGER NOT NULL,
    caste_category      ENUM('General', 'OBC', 'SC', 'ST', 'SBC', 'VJ', 'NT-A', 'NT-B', 'NT-C', 'NT-D', 'EWS') NOT NULL,
    gender              ENUM('Male', 'Female', 'Other') NOT NULL,
    enrollment_status   ENUM('Active', 'Inactive', 'Graduated', 'Dropped') DEFAULT 'Active',
    is_password_changed BOOLEAN DEFAULT FALSE,
    enrolled_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (batch_id) REFERENCES course_batches(id)
);

CREATE TABLE IF NOT EXISTS app_users (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(150) NOT NULL,
    email               VARCHAR(150) UNIQUE NOT NULL,
    password            VARCHAR(255) NOT NULL,
    contact_number      VARCHAR(15) NOT NULL,
    role                ENUM('principal', 'accountant', 'admin', 'student') NOT NULL,
    student_id          INTEGER DEFAULT NULL,
    is_active           BOOLEAN DEFAULT TRUE,
    is_password_changed BOOLEAN DEFAULT FALSE,
    refresh_token       TEXT DEFAULT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Student Fee Ledger (One row per academic year per student)
-- Canonical academic year labels used by the app:
-- 1 Year: FY
-- 2 Years: FY, SY
-- 3 Years: FY, SY, TY
-- 4 Years: FY, SY, TY, 4Y
-- 5 Years: FY, SY, TY, 4Y, 5Y
CREATE TABLE IF NOT EXISTS student_fee_ledger (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    student_id          INTEGER NOT NULL,
    academic_year       VARCHAR(20) NOT NULL,
    academic_year_num   INTEGER NOT NULL,
    total_yearly_fee    DECIMAL(10,2) NOT NULL CHECK (total_yearly_fee >= 0),
    total_paid          DECIMAL(10,2) DEFAULT 0.00 CHECK (total_paid >= 0),
    pending_fee         DECIMAL(10,2) AS (total_yearly_fee - total_paid) STORED,
    status              ENUM('Pending', 'Partial', 'Paid') DEFAULT 'Pending',
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, academic_year_num),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Fee Transactions (Immutable payment audit trail)
CREATE TABLE IF NOT EXISTS fee_transactions (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    student_id          INTEGER NOT NULL,
    ledger_id           INTEGER NOT NULL,
    amount_paid         DECIMAL(10,2) NOT NULL CHECK (amount_paid >= 0),
    payment_mode        ENUM('Cash', 'UPI', 'Bank Transfer', 'Cheque', 'DD', 'Online', 'Scholarship') NOT NULL,
    payment_reference   VARCHAR(100) DEFAULT NULL,
    receipt_number      VARCHAR(50) UNIQUE NOT NULL,
    remarks             VARCHAR(255) DEFAULT NULL,
    particulars          JSON DEFAULT NULL,
    application_id      VARCHAR(100) DEFAULT NULL,
    installment_no      INTEGER DEFAULT NULL,
    status              ENUM('Active', 'Reversed') DEFAULT 'Active',
    transaction_date    DATE NOT NULL DEFAULT (CURRENT_DATE),
    created_by          VARCHAR(100) DEFAULT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (ledger_id) REFERENCES student_fee_ledger(id) ON DELETE CASCADE
);

-- Scholarship Configurations
CREATE TABLE IF NOT EXISTS course_scholarship_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INTEGER,
    caste_category ENUM('General', 'OBC', 'SC', 'ST', 'SBC', 'VJ', 'NT-A', 'NT-B', 'NT-C', 'NT-D', 'EWS') NOT NULL,
    gender ENUM('Male', 'Female') NOT NULL,
    max_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(course_id, caste_category, gender),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Student Scholarship Applications
CREATE TABLE IF NOT EXISTS scholarship_applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INTEGER NOT NULL,
    academic_cycle VARCHAR(20) DEFAULT NULL,
    application_id VARCHAR(100) NOT NULL,
    application_id_extracted VARCHAR(100) DEFAULT NULL,
    form_path VARCHAR(300) NOT NULL,
    form_original_name VARCHAR(255) NOT NULL,
    match_status ENUM('matched') NOT NULL DEFAULT 'matched',
    submission_status ENUM('pending_verification', 'approved', 'rejected', 'conflict') NOT NULL DEFAULT 'pending_verification',
    ocr_status ENUM('queued', 'processing', 'completed', 'failed', 'mismatch') NOT NULL DEFAULT 'queued',
    ocr_error VARCHAR(255) DEFAULT NULL,
    ocr_attempts INT NOT NULL DEFAULT 0,
    last_ocr_at TIMESTAMP NULL DEFAULT NULL,
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP DEFAULT NULL,
    approved_by INTEGER DEFAULT NULL,
    rejected_at TIMESTAMP DEFAULT NULL,
    rejected_by INTEGER DEFAULT NULL,
    rejection_reason VARCHAR(255) DEFAULT NULL,
    UNIQUE(student_id),
    UNIQUE(application_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES app_users(id) ON DELETE SET NULL,
    FOREIGN KEY (rejected_by) REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS scholarship_ocr_jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_record_id INT NOT NULL,
    status ENUM('queued', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'queued',
    attempts INT NOT NULL DEFAULT 0,
    last_error VARCHAR(255) DEFAULT NULL,
    available_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_at TIMESTAMP NULL DEFAULT NULL,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_record_id) REFERENCES scholarship_applications(id) ON DELETE CASCADE
);

-- Scholarship audit trail
CREATE TABLE IF NOT EXISTS scholarship_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INTEGER,
    actor_user_id INTEGER,
    actor_role VARCHAR(20) NOT NULL,
    action VARCHAR(50) NOT NULL,
    details JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES scholarship_applications(id) ON DELETE SET NULL,
    FOREIGN KEY (actor_user_id) REFERENCES app_users(id) ON DELETE SET NULL
);

-- ============================================
-- Indexes for performance
-- ============================================

CREATE INDEX idx_courses_dept ON courses(department_id);
CREATE INDEX idx_courses_created ON courses(created_at);
CREATE INDEX idx_departments_created ON departments(created_at);
CREATE INDEX idx_batches_course ON course_batches(course_id);
CREATE INDEX idx_fees_batch ON course_fees(batch_id);

-- Student indexes
CREATE INDEX idx_students_department ON students(department_id);
CREATE INDEX idx_students_course ON students(course_id);
CREATE INDEX idx_students_batch ON students(batch_id);
CREATE INDEX idx_students_email ON students(email);
CREATE INDEX idx_students_status ON students(enrollment_status);
CREATE INDEX idx_students_password_changed ON students(is_password_changed);

CREATE INDEX idx_app_users_email ON app_users(email);
CREATE INDEX idx_app_users_role ON app_users(role);
CREATE INDEX idx_app_users_student_id ON app_users(student_id);
CREATE INDEX idx_app_users_active ON app_users(is_active);

-- Fee ledger indexes
CREATE INDEX idx_ledger_student ON student_fee_ledger(student_id);
CREATE INDEX idx_ledger_status ON student_fee_ledger(status);

-- Transaction indexes
CREATE INDEX idx_txn_student ON fee_transactions(student_id);
CREATE INDEX idx_txn_ledger ON fee_transactions(ledger_id);
CREATE INDEX idx_txn_date ON fee_transactions(transaction_date);
CREATE INDEX idx_txn_receipt ON fee_transactions(receipt_number);
CREATE INDEX idx_txn_status ON fee_transactions(status);
CREATE INDEX idx_txn_application_id ON fee_transactions(application_id);

-- Note: MySQL does not support Partial Indexes (WHERE clause in index). 
-- You might need to handle the uniqueness of scholarship disbursals at the application level.
-- CREATE UNIQUE INDEX idx_unique_scholarship_disbursal ON fee_transactions (student_id, application_id, installment_no);

CREATE INDEX idx_sch_app_student ON scholarship_applications(student_id);
CREATE INDEX idx_sch_app_status ON scholarship_applications(submission_status);
CREATE INDEX idx_sch_app_ocr_status ON scholarship_applications(ocr_status);
CREATE INDEX idx_sch_app_submitted ON scholarship_applications(submitted_at);

CREATE INDEX idx_sch_audit_application ON scholarship_audit_logs(application_id);
CREATE INDEX idx_sch_audit_created ON scholarship_audit_logs(created_at);
CREATE INDEX idx_sch_ocr_jobs_status ON scholarship_ocr_jobs(status, available_at);

-- Optional cleanup for legacy fee-component labels:
-- UPDATE course_fees SET component_name = REPLACE(component_name, 'Y4 - ', '4Y - ') WHERE component_name LIKE 'Y4 - %';
-- UPDATE course_fees SET component_name = REPLACE(component_name, 'Y5 - ', '5Y - ') WHERE component_name LIKE 'Y5 - %';
-- UPDATE course_fees SET component_name = REPLACE(component_name, 'Fourth Year - ', '4Y - ') WHERE component_name LIKE 'Fourth Year - %';
-- UPDATE course_fees SET component_name = REPLACE(component_name, 'Fifth Year - ', '5Y - ') WHERE component_name LIKE 'Fifth Year - %';
-- UPDATE course_fees cf
-- JOIN course_batches cb ON cf.batch_id = cb.id
-- JOIN courses c ON cb.course_id = c.id
-- SET cf.component_name = REPLACE(cf.component_name, 'Final Year - ', '4Y - ')
-- WHERE cf.component_name LIKE 'Final Year - %' AND c.duration = '4 Years';
-- UPDATE course_fees cf
-- JOIN course_batches cb ON cf.batch_id = cb.id
-- JOIN courses c ON cb.course_id = c.id
-- SET cf.component_name = REPLACE(cf.component_name, 'Final Year - ', '5Y - ')
-- WHERE cf.component_name LIKE 'Final Year - %' AND c.duration = '5 Years';
