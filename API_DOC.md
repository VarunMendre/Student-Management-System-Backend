# API Documentation: Student Management System (Backend)

This document provides the necessary details for integrating the Frontend with the Backend API. 

## Base Configuration
- **Base URL**: `http://localhost:5000/api/v1`
- **Content-Type**: `application/json`

---

## Response Structure
The API follows a consistent response structure using the `customResponse` utility:

### Success Response
```json
{
    "success": true,
    "message": "Action completed successfully",
    "data": { ... } // Or an array [...]
}
```

### Error Response
```json
{
    "success": false,
    "error": "Error message description",
    "statusCode": 400
}
```

---

## 1. Departments Module
Endpoint: `/departments`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/departments` | Fetches all departments. |
| POST | `/departments` | Creates a new department. |
| PUT | `/departments/:id` | Updates a department by ID. |
| DELETE | `/departments/:id` | Deletes a department by ID. |

### Payload (POST/PUT)
```json
{ "name": "Computer Science" }
```

---

## 2. Courses Module
Endpoint: `/courses`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/courses` | Fetches all courses (includes department_name). |
| GET | `/courses/:id` | Fetches details of a single course. |
| POST | `/courses` | Creates a new course. |
| PUT | `/courses/:id` | Updates an existing course. |
| DELETE | `/courses/:id` | Deletes a course by ID. |

### Payload (POST/PUT)
```json
{
    "course_name": "Bachelor of Technology",
    "duration": "4 Years",
    "department_id": 1,
    "course_code": "BTECH-CS",
    "program_level": "UG",
    "seats": 60
}
```

---

## Technical Constraints
### Enums
- **Duration**: `'1 Year'`, `'2 Years'`, `'3 Years'`, `'4 Years'`, `'5 Years'`
- **Program Level**: `'UG'`, `'PG'`

### Dependencies
- A Course must belong to a valid `department_id`.

---

## Integration Guide for AI Agent (Frontend)

To migrate from `localStorage` to this Backend API, follow these steps:

1.  **Axios/Fetch Setup**: Create an API instance with the base URL `http://localhost:5000/api/v1`.
2.  **DataContext Refactor**:
    *   Initialize states (e.g., `departments`, `courses`) as empty arrays `[]`.
    *   Use a `useEffect` to fetch data from the `GET` endpoints on initial load.
3.  **Error Handling**: Wrap API calls in `try-catch` blocks and use the `error` field from the response.
