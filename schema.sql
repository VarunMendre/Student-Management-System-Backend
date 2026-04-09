-- Schema for Student Management System (Minimal)


-- Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Students Table
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_courses_dept ON courses(department_id);
CREATE INDEX IF NOT EXISTS idx_courses_created ON courses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_departments_created ON departments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batches_course ON course_batches(course_id);
CREATE INDEX IF NOT EXISTS idx_fees_batch ON course_fees(batch_id);
