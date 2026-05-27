CREATE TABLE IF NOT EXISTS student_over_collection (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    from_academic_year_num INT NOT NULL,
    carried_to_academic_year_num INT NULL,
    source VARCHAR(30) NOT NULL DEFAULT 'Scholarship',
    source_txn_id INT NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    is_refunded BOOLEAN NOT NULL DEFAULT FALSE,
    refunded_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (source_txn_id) REFERENCES fee_transactions(id) ON DELETE SET NULL
);

CREATE INDEX idx_over_collection_student ON student_over_collection(student_id);
CREATE INDEX idx_over_collection_refund ON student_over_collection(student_id, is_refunded);

CREATE TABLE IF NOT EXISTS student_refunds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status ENUM('pending', 'processed') NOT NULL DEFAULT 'pending',
    remarks VARCHAR(255) DEFAULT NULL,
    processed_date DATE DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX idx_refunds_student ON student_refunds(student_id);
