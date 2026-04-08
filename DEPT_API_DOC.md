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

### GET All Departments
- **URL**: `/departments`
- **Method**: `GET`
- **Description**: Fetches all departments from the database.
- **Action for FE**: Replace `localStorage.getItem('departments')` logic.

### CREATE Department
- **URL**: `/departments`
- **Method**: `POST`
- **Payload**:
  ```json
  { "name": "Department Name" }
  ```
- **Description**: Creates a new department.
- **Action for FE**: Send content from the "Add Department" form.

### UPDATE Department
- **URL**: `/departments/:id`
- **Method**: `PUT`
- **Payload**:
  ```json
  { "name": "Updated Name" }
  ```
- **Description**: Updates an existing department name by its ID.

### DELETE Department
- **URL**: `/departments/:id`
- **Method**: `DELETE`
- **Description**: Deletes a department by ID.

---

## Integration Guide for AI Agent (Frontend)

To migrate from `localStorage` to this Backend API, follow these steps:

1.  **Axios/Fetch Setup**: Create an API instance with the base URL `http://localhost:5000/api/v1`.
2.  **DataContext Refactor**:
    *   Initialize states (e.g., `departments`) as empty arrays `[]`.
    *   Use a `useEffect` to fetch data from the `GET` endpoints on initial load.
    *   Replace direct `setDepartments` calls in forms with async API calls.
3.  **Error Handling**: Wrap API calls in `try-catch` blocks and use the `error` field from the response to show notifications to the user.
4.  **Optimistic Updates (Optional)**: Update the local state immediately after a successful API response to keep the UI snappy.

### Example Fetch (for AI Agent Reference):
```javascript
const fetchDepartments = async () => {
    try {
        const response = await axios.get('/departments');
        if (response.data.success) {
            setDepartments(response.data.data);
        }
    } catch (error) {
        console.error("Failed to fetch departments", error);
    }
};
```
