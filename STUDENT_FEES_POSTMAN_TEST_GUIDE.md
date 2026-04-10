# 🚀 Complete Postman Testing Guide — Student & Fee Management

Base URL: `http://localhost:5000`

---

## 1. Student Enrollment (Core API)

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
- **Expected Success (201)**: Returns the student profile plus an auto-generated `fee_summary` with a ledger for all years (FY, SY, etc.).

### **B. List All Students (with Search/Filters)**
- **Method**: `GET`
- **URL**: `/api/v1/students`
- **Optional Query Params**:
  - `?search=Rahul` (Searches Name, Email, or PRN)
  - `?department_id=1` (Filter by Department)
  - `?status=Active` (Filter by Enrollment Status)
- **Expected Success (200)**: Returns an array of students with aggregated fee totals (`total_course_fee`, `total_paid`, `total_pending`).

### **C. Get Single Student Full Details**
- **Method**: `GET`
- **URL**: `/api/v1/students/:id` (e.g., `/api/v1/students/1`)
- **Expected Success (200)**: Returns everything—Profile, Yearly Ledger, and recent Transaction history.

### **D. Update Student Profile**
- **Method**: `PATCH`
- **URL**: `/api/v1/students/:id`
- **Body (JSON)**:
```json
{
    "prn_number": "PRN20250001",
    "enrollment_status": "Active",
    "mobile_number": "9999888877"
}
```
- **Expected Success (200)**: Returns the updated fields.

---

## 2. Fee Management & Ledger

### **E. Record a Fee Payment**
- **Method**: `POST`
- **URL**: `/api/v1/students/:id/payments`
- **Body (JSON)**:
```json
{
    "ledger_id": 1,
    "amount_paid": 15000.00,
    "payment_mode": "UPI",
    "payment_reference": "UTR123456789",
    "remarks": "Tuition fee installment",
    "transaction_date": "2026-04-10"
}
```
- **Expected Success (201)**: Returns transaction info with an auto-generated `receipt_number` and the updated ledger state.

### **F. Get Fee Ledger Breakdown**
- **Method**: `GET`
- **URL**: `/api/v1/students/:id/fee-ledger`
- **Expected Success (200)**: returns year-by-year fee status (FY, SY, TY, etc.) and a master summary of all dues.

---

## 3. Transactions & Receipts

### **G. List All Transactions for a Student**
- **Method**: `GET`
- **URL**: `/api/v1/students/:id/transactions`
- **Optional Query Params**: `?academic_year_num=1` (to see only FY payments)
- **Expected Success (200)**: List of all payment records for that student.

### **H. Get Single Transaction (Receipt View)**
- **Method**: `GET`
- **URL**: `/api/v1/students/:id/transactions/:txn_id`
- **Expected Success (200)**: Provides data specifically formatted for a receipt.
- **Key Field**: `amount_in_words` (e.g., "Fifteen Thousand Rupees Only") — processed by our backend utility.

---

## 4. Error Cases (Validation & Business Rules)

Try These to Check System Robustness:

1. **Duplicate Email Block**: Use an email that already exists in `POST /api/v1/students`.
   - *Expect: 409 Conflict*
2. **Overpayment Prevention**: Pay an amount higher than the `pending_fee` in `POST /api/v1/students/:id/payments`.
   - *Expect: 400 Bad Request*
3. **Invalid Payment Mode**: Send `"payment_mode": "Bitcoin"` or something not in the list (Cash, UPI, etc.).
   - *Expect: 400 Bad Request (Validation Error)*
4. **Batch Seat Limit**: Enroll more students than the `total_seats` defined in the batch.
   - *Expect: 409 Conflict*
5. **Non-Numeric ID**: GET `/api/v1/students/abc`.
   - *Expect: 400 Bad Request (Validation Error)*

---

## Summary of New Tables:
- `students`: Core enrollment records.
- `student_fee_ledger`: Yearly snapshots of fees owed vs paid.
- `fee_transactions`: Immutable history of every payment (Audit Trail).
