# Scholarship Module - Frontend Integration Guide

This document outlines the workflow and API endpoints for the Frontend Developer to interact with the Backend Scholarship Module. 

The backend has been completely refactored to be fast, secure, and resilient against mathematical edge cases (such as over-paying limits or double processing).

## 🚀 The Excel File Upload Workflow
**IMPORTANT FOR FRONTEND:** The backend **does not** accept binary `.xlsx` files. 

Because we have a "Pre-Import Review Modal" UI constraint, the flow must be:
1. User selects an Excel sheet.
2. The **Frontend** parses the Excel sheet locally in the browser (using tools like `xlsx` or `papaparse`).
3. The Frontend displays the parsed rows to the admin in a preview data grid.
4. When the admin clicks **"Confirm & Disburse"**, the frontend sends a `JSON array` of the parsed rows to the `POST /api/v1/scholarship/disburse` endpoint.

---

## 📡 API Endpoints 

### 1. Configure Course Scholarship Limits
Set the maximum government grant allowed per category and gender for a specific course.

- **URL:** `POST /api/v1/scholarship/config`
- **Body:**
```json
{
  "course_id": 9,
  "configs": [
    { "caste_category": "OBC", "gender": "Male", "max_amount": 50000 },
    { "caste_category": "SC", "gender": "Female", "max_amount": 80000 }
  ]
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Scholarship configuration updated"
}
```

### 2. Fetch Course Configurations (Settings Page)
Retrieve existing limits to prepopulate settings forms.

- **URL:** `GET /api/v1/scholarship/config/:courseId`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "course_id": 9,
      "caste_category": "OBC",
      "gender": "Male",
      "max_amount": "50000.00",
      "is_active": true
    }
  ]
}
```

### 3. Disburse Scholarships (The JSON Array Upload)
This is where the parsed Excel data goes. The backend automatically handles limit capping and balance verification. 

- **URL:** `POST /api/v1/scholarship/disburse`
- **Body:**
```json
{
  "disbursements": [
     {
        "student_id": 1,
        "amount": 80000,
        "installment_no": 1,
        "application_id": "GOV-APP-123",
        "academic_year_num": 1
     },
     {
        "student_id": 2,
        "amount": 80000,
        "installment_no": 1,
        "application_id": "GOV-APP-124",
        "academic_year_num": 1
     }
  ]
}
```
- **Response (200 OK):** *(Notice it returns what succeeded, what failed, and exact amounts applied if capped)*
```json
{
  "success": true,
  "summary": { "total": 2, "success": 1, "failed": 1 },
  "results": [
    {
      "student_id": 1,
      "status": "success",
      "student_name": "Pooja Desai",
      "amount_applied": 80000,
      "receipt_number": "RCP-20260413-0001"
    },
    {
      "student_id": 2,
      "status": "failed",
      "amount_requested": 80000,
      "error": "Limit reached (₹50000)"
    }
  ]
}
```

### 4. Fetch Scholarship Summary (For Dashboard Charts)
Fetch aggregated stats grouped by Course and Department to display total funds disbursed.

- **URL:** `GET /api/v1/scholarship/summary`
- **Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "department_name": "Testing Department",
      "course_name": "B.Tech Test Engineering",
      "total_disbursals": "15",
      "total_amount": "1200000.00"
    }
  ]
}
```

### 5. Reverse a Disbursal (Undo)
If a scholarship is rejected post-approval or a mistake was made, this reverts the transaction and restores the student's pending fee.

- **URL:** `DELETE /api/v1/scholarship/reverse/:txnId`
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Reversed successfully"
}
```

---

## 🛑 Important Rules for Frontend
1. The backend operates on an **"All-or-Partial" batch system**. If 50 students are sent in the payload and 2 violate limits, the backend will still save the 48 successful students and return `status: failed` for the two specific records. The UI should display the `results` array so the Admin can see which specific rows failed and why.
2. The `academic_year_num` determines which year's fee ledger the scholarship should subtract from (1 = FY, 2 = SY, etc.). This MUST be calculated/included in the frontend payload.
