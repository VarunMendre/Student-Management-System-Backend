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
    enrolled_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
