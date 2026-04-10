# 🚀 Postman Testing Guide — Student & Fee Management

Base URL: `http://localhost:5000`

---

## 1. Student Enrollment (Initial Setup)

### **A. Enroll a New Student**
- **Method**: `POST`
- **URL**: `/api/v1/students`
- **Body (JSON)**:
```json
{
    "full_name": "Rahul Sharma",
    "email": "rahul.sharma@example.com",
    "mobile_number": "9876543210",
    "alternate_number": "9123456789",
    "department_id": 1,
    "course_id": 1,
    "batch_id": 1,
    "caste_category": "OBC",
    "gender": "Male"
}
```
- **Expected Output (201 Created)**:
```json
{
    "success": true,
    "message": "Student enrolled successfully",
    "id": 1,
    "full_name": "Rahul Sharma",
    "email": "rahul.sharma@example.com",
    "fee_summary": {
        "total_course_fee": 420000,
        "yearly_fee": 105000,
        "years": 4,
        "ledger": [
            { "academic_year": "FY", "status": "Pending", "pending_fee": 105000 },
            { "academic_year": "SY", "status": "Pending", "pending_fee": 105000 },
            ...
        ]
    }
}
```

---

## 2. Fee Payments & Transactions

### **A. Record a Payment**
- **Method**: `POST`
- **URL**: `/api/v1/students/1/payments`
- **Body (JSON)**:
```json
{
    "ledger_id": 1,
    "amount_paid": 20000,
    "payment_mode": "UPI",
    "payment_reference": "UTR_ABC_123",
    "remarks": "Part payment for First Year"
}
```
- **Expected Output (201 Created)**:
```json
{
    "success": true,
    "message": "Payment recorded successfully",
    "transaction": {
        "id": 1,
        "receipt_number": "RCP-20260410-0001",
        "amount_paid": 20000
    },
    "updated_ledger": {
        "ledger_id": 1,
        "total_paid": 20000,
        "pending_fee": 85000,
        "status": "Partial"
    }
}
```

### **B. Get Recent Transactions**
- **Method**: `GET`
- **URL**: `/api/v1/students/1/transactions`
- **Expected Output (200 OK)**: A list of all payments made by Rahul.

---

## 3. Student Details & Ledger Breakdown

### **A. Get Full Student Profile**
- **Method**: `GET`
- **URL**: `/api/v1/students/1`
- **Expected Output (200 OK)**: Returns full info, the complete multi-year ledger, and transaction history.

### **B. Get Fee Ledger Only**
- **Method**: `GET`
- **URL**: `/api/v1/students/1/fee-ledger`
- **Expected Output (200 OK)**: Summary of totals (Total Fee, Total Paid, Total Pending) across all years.

---

## 4. Updates & Management

### **A. Update Student Info**
- **Method**: `PATCH`
- **URL**: `/api/v1/students/1`
- **Body (JSON)**:
```json
{
    "prn_number": "PRN12345",
    "enrollment_status": "Active"
}
```

---

## 5. Edge Cases to Test (Error Handling)

| Case | Action | Expected Status | Expected Error Message |
|---|---|---|---|
| **Duplicate Email** | Enroll student with existing email | **409 Conflict** | "A student with this email already exists" |
| **Overpayment** | Pay 10,000 for a 5,000 balance | **400 Bad Request** | "Payment amount exceeds pending fee..." |
| **Empty JSON** | Send empty body to Patch | **400 Bad Request** | "At least one field must be provided..." |
| **Invalid ID** | GET /api/v1/students/9999 | **404 Not Found** | "Student not found" |
| **Full Batch** | Enroll when seats = 0 | **409 Conflict** | "Batch is full. No available seats." |
