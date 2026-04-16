-- Schema for Student Management System (Minimal)


-- Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Courses Table
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    course_name VARCHAR(100) NOT NULL,
    duration VARCHAR(20) CHECK (duration IN ('1 Year', '2 Years', '3 Years', '4 Years', '5 Years')),
    department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
    course_code VARCHAR(20) UNIQUE,
    program_level VARCHAR(5) CHECK (program_level IN ('UG', 'PG')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- UPDATED: Course Batches Table 
CREATE TABLE IF NOT EXISTS course_batches (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    batch_name VARCHAR(50) NOT NULL,
    admission_year INTEGER NOT NULL,
    total_seats INTEGER NOT NULL DEFAULT 0, 
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, batch_name)
);


-- Table to store the breakdown of fees for a specific batch
CREATE TABLE IF NOT EXISTS course_fees (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER REFERENCES course_batches(id) ON DELETE CASCADE,
    component_name VARCHAR(100) NOT NULL, 
    amount DECIMAL(10, 2) NOT NULL,       
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Students Table (Enrollment Record)
CREATE TABLE IF NOT EXISTS students (
    id                  SERIAL PRIMARY KEY,
    full_name           VARCHAR(150) NOT NULL,
    email               VARCHAR(150) UNIQUE NOT NULL,
    mobile_number       VARCHAR(15) NOT NULL,
    alternate_number    VARCHAR(15) NOT NULL,
    prn_number          VARCHAR(50) DEFAULT NULL,
    eligibility_number  VARCHAR(50) DEFAULT NULL,
    department_id       INTEGER NOT NULL REFERENCES departments(id),
    course_id           INTEGER NOT NULL REFERENCES courses(id),
    batch_id            INTEGER NOT NULL REFERENCES course_batches(id),
    caste_category      VARCHAR(50) NOT NULL,
    gender              VARCHAR(10) NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    enrollment_status   VARCHAR(20) DEFAULT 'Active' CHECK (enrollment_status IN ('Active', 'Inactive', 'Graduated', 'Dropped')),
    is_password_changed BOOLEAN DEFAULT FALSE,
    enrolled_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_users (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(150) NOT NULL,
    email               VARCHAR(150) UNIQUE NOT NULL,
    password            VARCHAR(255) NOT NULL,
    contact_number      VARCHAR(15) NOT NULL,
    role                VARCHAR(20) NOT NULL CHECK (role IN ('principal', 'accountant', 'admin', 'student')),
    student_id          INTEGER REFERENCES students(id) ON DELETE CASCADE DEFAULT NULL,
    is_active           BOOLEAN DEFAULT TRUE,
    is_password_changed BOOLEAN DEFAULT FALSE,
    refresh_token       TEXT DEFAULT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE students
ADD COLUMN IF NOT EXISTS is_password_changed BOOLEAN DEFAULT FALSE;

ALTER TABLE app_users
ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE app_users
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE app_users
ADD COLUMN IF NOT EXISTS is_password_changed BOOLEAN DEFAULT FALSE;

ALTER TABLE app_users
ADD COLUMN IF NOT EXISTS refresh_token TEXT DEFAULT NULL;

ALTER TABLE app_users
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE app_users
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Student Fee Ledger (One row per academic year per student)
CREATE TABLE IF NOT EXISTS student_fee_ledger (
    id                  SERIAL PRIMARY KEY,
    student_id          INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    academic_year       VARCHAR(20) NOT NULL,
    academic_year_num   INTEGER NOT NULL,
    total_yearly_fee    DECIMAL(10,2) NOT NULL,
    total_paid          DECIMAL(10,2) DEFAULT 0.00,
    pending_fee         DECIMAL(10,2) GENERATED ALWAYS AS (total_yearly_fee - total_paid) STORED,
    status              VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Partial', 'Paid')),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, academic_year_num)
);

-- Fee Transactions (Immutable payment audit trail)
CREATE TABLE IF NOT EXISTS fee_transactions (
    id                  SERIAL PRIMARY KEY,
    student_id          INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    ledger_id           INTEGER NOT NULL REFERENCES student_fee_ledger(id) ON DELETE CASCADE,
    amount_paid         DECIMAL(10,2) NOT NULL CHECK (amount_paid > 0),
    payment_mode        VARCHAR(30) NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Bank Transfer', 'Cheque', 'DD', 'Online', 'Scholarship')),
    payment_reference   VARCHAR(100) DEFAULT NULL,
    receipt_number      VARCHAR(50) UNIQUE NOT NULL,
    remarks             VARCHAR(255) DEFAULT NULL,
    application_id      VARCHAR(100) DEFAULT NULL,
    installment_no      INTEGER DEFAULT NULL,
    status              VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Reversed')),
    transaction_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by          VARCHAR(100) DEFAULT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scholarship Configurations
CREATE TABLE IF NOT EXISTS course_scholarship_config (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    caste_category VARCHAR(50) NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('Male', 'Female')),
    max_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(course_id, caste_category, gender)
);

-- ============================================
-- Indexes for performance
-- ============================================

-- Existing indexes
CREATE INDEX IF NOT EXISTS idx_courses_dept ON courses(department_id);
CREATE INDEX IF NOT EXISTS idx_courses_created ON courses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_departments_created ON departments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batches_course ON course_batches(course_id);
CREATE INDEX IF NOT EXISTS idx_fees_batch ON course_fees(batch_id);

-- Student indexes
CREATE INDEX IF NOT EXISTS idx_students_department ON students(department_id);
CREATE INDEX IF NOT EXISTS idx_students_course ON students(course_id);
CREATE INDEX IF NOT EXISTS idx_students_batch ON students(batch_id);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(enrollment_status);
CREATE INDEX IF NOT EXISTS idx_students_password_changed ON students(is_password_changed);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);
CREATE INDEX IF NOT EXISTS idx_app_users_student_id ON app_users(student_id);
CREATE INDEX IF NOT EXISTS idx_app_users_active ON app_users(is_active);

-- Fee ledger indexes
CREATE INDEX IF NOT EXISTS idx_ledger_student ON student_fee_ledger(student_id);
CREATE INDEX IF NOT EXISTS idx_ledger_status ON student_fee_ledger(status);

-- Transaction indexes
CREATE INDEX IF NOT EXISTS idx_txn_student ON fee_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_txn_ledger ON fee_transactions(ledger_id);
CREATE INDEX IF NOT EXISTS idx_txn_date ON fee_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_txn_receipt ON fee_transactions(receipt_number);
CREATE INDEX IF NOT EXISTS idx_txn_status ON fee_transactions(status);
CREATE INDEX IF NOT EXISTS idx_txn_application_id ON fee_transactions(application_id);

-- Prevent duplicate scholarship disbursals
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_scholarship_disbursal 
ON fee_transactions (student_id, application_id, installment_no) 
WHERE (payment_mode = 'Scholarship' AND application_id IS NOT NULL AND installment_no IS NOT NULL);

-- Student Scholarship Applications (self-submitted PDF form flow)
CREATE TABLE IF NOT EXISTS scholarship_applications (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    academic_cycle VARCHAR(20) DEFAULT NULL,
    application_id VARCHAR(100) NOT NULL,
    application_id_extracted VARCHAR(100) NOT NULL,
    form_path VARCHAR(300) NOT NULL,
    form_original_name VARCHAR(255) NOT NULL,
    match_status VARCHAR(20) NOT NULL DEFAULT 'matched' CHECK (match_status IN ('matched')),
    submission_status VARCHAR(30) NOT NULL DEFAULT 'pending_verification' CHECK (submission_status IN ('pending_verification', 'approved', 'rejected', 'conflict')),
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP DEFAULT NULL,
    approved_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
    rejected_at TIMESTAMP DEFAULT NULL,
    rejected_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
    rejection_reason VARCHAR(255) DEFAULT NULL,
    UNIQUE(student_id),
    UNIQUE(application_id)
);

CREATE INDEX IF NOT EXISTS idx_sch_app_student ON scholarship_applications(student_id);
CREATE INDEX IF NOT EXISTS idx_sch_app_status ON scholarship_applications(submission_status);
CREATE INDEX IF NOT EXISTS idx_sch_app_submitted ON scholarship_applications(submitted_at DESC);

-- Scholarship audit trail (minimal immutable logs)
CREATE TABLE IF NOT EXISTS scholarship_audit_logs (
    id SERIAL PRIMARY KEY,
    application_id INTEGER REFERENCES scholarship_applications(id) ON DELETE SET NULL,
    actor_user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
    actor_role VARCHAR(20) NOT NULL,
    action VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sch_audit_application ON scholarship_audit_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_sch_audit_created ON scholarship_audit_logs(created_at DESC);
