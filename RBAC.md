# Backend RBAC Implementation Plan

This document is the production-level backend authorization plan for the Student Management System. It is written against the current backend API surface and must be treated as the source of truth for backend access control.

Frontend hiding is not security. The backend must enforce every rule below even if the frontend shows or sends something incorrectly.

## 1. Roles

The system uses the `app_users.role` column with these valid roles:

- `principal`
- `accountant`
- `admin`
- `student`

## 2. Security Principles

### 2.1 Authentication

- All `/api/v1/auth/*` routes are public only where explicitly noted.
- All non-auth routes must require a valid access token.
- Access token must be validated on every protected request.
- Refresh token must remain cookie-based and httpOnly.

### 2.2 Authorization

- Authorization is backend-enforced.
- Route-level role checks must run before controller logic.
- Student ownership checks must run before any data access for student-scoped resources.
- A valid role alone is not enough for `student`; ownership must also match.

### 2.3 Student Data Isolation

Students must never be allowed to read or mutate another student's data by changing path params, query params, or request body values.

This means:

- `student` requests must be resolved from authenticated identity, not trusted from request params alone.
- Any route receiving `:id`, `student_id`, `ledger_id`, `txn_id`, or similar identifiers must verify ownership before returning data.
- Where practical, student-only endpoints should internally ignore foreign IDs and use the authenticated student's own mapping.

## 3. JWT and Request Identity Contract

### 3.1 Access Token Payload

The access token payload must include:

```json
{
  "userId": 123,
  "email": "finance@college.edu",
  "role": "accountant",
  "student_id": null,
  "type": "AccessToken"
}
```

For student accounts:

```json
{
  "userId": 456,
  "email": "student@college.edu",
  "role": "student",
  "student_id": 91,
  "type": "AccessToken"
}
```

### 3.2 `req.user` Contract

After access token verification, `req.user` must contain:

- `userId`
- `email`
- `role`
- `student_id`

This becomes the shared identity object for all authorization middleware and services.

## 4. Authorization Middleware Set

The backend should standardize on these middleware responsibilities:

### 4.1 `verifyAccessToken`

- Validates access token
- Rejects invalid or expired access token with `401`
- Attaches normalized `req.user`

### 4.2 `authorizeRoles(...roles)`

- Allows only listed roles
- Rejects authenticated but disallowed access with `403`

### 4.3 `requireStudentOwnership`

Use for endpoints where a student accesses their own record through a path param.

Responsibilities:

- If role is not `student`, pass through
- If role is `student`, ensure route target belongs to `req.user.student_id`
- Reject mismatch with `403`

### 4.4 `resolveStudentScope`

Optional helper middleware or service utility for nested student resources.

Responsibilities:

- Derive effective student id from token for `student`
- Use requested student id for staff roles
- Prevent controllers/services from trusting raw params directly

### 4.5 `authorizeStudentOrRoles(...staffRoles)`

Use when both student-self and staff access are allowed.

Example:

- `student` can access only self
- `principal`, `accountant`, `admin` can access any allowed record

## 5. Canonical Permission Policy

This section is the backend source of truth for the current system.

### 5.1 User Management

Resource: `app_users`

- `principal`: full access
- `accountant`: no access
- `admin`: no access
- `student`: no access

Notes:

- Principal account must not be editable/deletable by non-principal routes or future staff actions.
- Existing “principal cannot be modified from this page” safeguard should remain.

### 5.2 Departments

Resource: `departments`

- `principal`: create, read, update, delete
- `accountant`: read only
- `admin`: read only
- `student`: no access

### 5.3 Courses

Resource: `courses`

- `principal`: create, read, update, delete
- `accountant`: create, read, update, delete
- `admin`: read only
- `student`: no access

### 5.4 Batches and Standard Course Fees

Resources:

- `course_batches`
- `course_fees`

- `principal`: create, read, update
- `accountant`: create, read, update
- `admin`: read only
- `student`: no access

Notes:

- `admin` may view configured fees but cannot create batches or change batch fee components.

### 5.5 Students

Resources:

- `students`
- student profile and academic metadata

- `principal`: create, read, update
- `accountant`: create, read, update
- `admin`: read only
- `student`: read own record only

Notes:

- Student listing endpoint must not return all students to `student` role.
- Student detail endpoint must be ownership-scoped for `student`.

### 5.6 Finance

Resources:

- `student_fee_ledger`
- `fee_transactions`
- manual fee collection

- `principal`: full access
- `accountant`: full access
- `admin`: read only
- `student`: read own ledger and own transactions only

Important rule:

- `POST` and `PATCH`/`PUT` actions that create or alter fee collection state must be allowed only for `principal` and `accountant`.

### 5.7 Scholarship

Resources:

- `course_scholarship_config`
- `scholarship_applications`
- scholarship disbursal and reconciliation

#### Configuration

- `principal`: read and update
- `accountant`: read only
- `admin`: read and update
- `student`: no access

#### Applications

- `principal`: read all
- `accountant`: read all
- `admin`: full operational access
- `student`: submit and view own application only

#### Reconciliation / Approval / Disbursal / Reverse

- `principal`: allowed
- `accountant`: read-only visibility for application data, but no approval/disbursal/reversal authority
- `admin`: allowed
- `student`: not allowed

This resolves the earlier ambiguity: `admin` is the primary scholarship operator; `accountant` is read-only in scholarship operations.

### 5.8 Reports

Resources:

- aggregated transaction reports
- cross-student financial reporting

- `principal`: read
- `accountant`: read
- `admin`: no access
- `student`: no access

## 6. Endpoint-Level Access Matrix

This section maps the current backend routes to exact role rules.

## 6.1 Auth Routes

### `POST /api/v1/auth/login`

- Public

### `POST /api/v1/auth/refresh`

- Public with valid refresh cookie

### `POST /api/v1/auth/logout`

- Any authenticated user

### `GET /api/v1/auth/me`

- Any authenticated user

### `POST /api/v1/auth/reset-password`

- Any authenticated user

## 6.2 User Management Routes

### `GET /api/v1/users`

- `principal`

### `POST /api/v1/users`

- `principal`

### `PATCH /api/v1/users/:id/role`

- `principal`

### `PATCH /api/v1/users/:id/deactivate`

- `principal`

### `PATCH /api/v1/users/:id/recover`

- `principal`

### `DELETE /api/v1/users/:id`

- `principal`

### `DELETE /api/v1/users/:id/session`

- `principal`

## 6.3 Department Routes

### `GET /api/v1/departments`

- `principal`
- `accountant`
- `admin`

### `GET /api/v1/departments/:id`

- `principal`
- `accountant`
- `admin`

### `POST /api/v1/departments`

- `principal`

### `PUT /api/v1/departments/:id`

- `principal`

### `DELETE /api/v1/departments/:id`

- `principal`

## 6.4 Course Routes

### `GET /api/v1/courses`

- `principal`
- `accountant`
- `admin`

### `GET /api/v1/courses/:id`

- `principal`
- `accountant`
- `admin`

### `POST /api/v1/courses`

- `principal`
- `accountant`

### `PUT /api/v1/courses/:id`

- `principal`
- `accountant`

### `DELETE /api/v1/courses/:id`

- `principal`
- `accountant`

## 6.5 Batch Routes

### `GET /api/v1/batches`

- `principal`
- `accountant`
- `admin`

### `GET /api/v1/batches/:batch_id`

- `principal`
- `accountant`
- `admin`

### `POST /api/v1/batches`

- `principal`
- `accountant`

### `PUT /api/v1/batches/:batch_id/fees`

- `principal`
- `accountant`

## 6.6 Student Routes

### `POST /api/v1/students`

- `principal`
- `accountant`

### `GET /api/v1/students`

- `principal`
- `accountant`
- `admin`

Special rule:

- `student` must not use this staff listing endpoint.
- If student self-profile listing is needed, expose a dedicated self endpoint or internally convert to self-only response.

### `GET /api/v1/students/:id`

- `principal`
- `accountant`
- `admin`
- `student` only for own record

### `PATCH /api/v1/students/:id`

- `principal`
- `accountant`

Notes:

- `admin` is read-only and cannot update student profile data.
- `student` cannot patch own student profile through this endpoint unless a dedicated self-service endpoint is added later.

## 6.7 Student Finance Routes

### `POST /api/v1/students/:id/payments`

- `principal`
- `accountant`

### `GET /api/v1/students/:id/transactions`

- `principal`
- `accountant`
- `admin`
- `student` only for own transactions

### `GET /api/v1/students/:id/transactions/:txn_id`

- `principal`
- `accountant`
- `admin`
- `student` only for own transaction

### `GET /api/v1/students/:id/fee-ledger`

- `principal`
- `accountant`
- `admin`
- `student` only for own ledger

## 6.8 Global Transaction Report Routes

### `GET /api/v1/transactions`

- `principal`
- `accountant`

## 6.9 Scholarship Routes

### `POST /api/v1/scholarship/application/submit`

- `student`

Own-scope rule:

- Submitted application must be bound to authenticated `req.user.student_id`

### `GET /api/v1/scholarship/application/me`

- `student`

### `GET /api/v1/scholarship/applications`

- `principal`
- `accountant`
- `admin`

### `POST /api/v1/scholarship/reconcile`

- `principal`
- `admin`

### `GET /api/v1/scholarship/config/:courseId`

- `principal`
- `accountant`
- `admin`

### `POST /api/v1/scholarship/config`

- `principal`
- `admin`

### `POST /api/v1/scholarship/disburse`

- `principal`
- `admin`

### `GET /api/v1/scholarship/summary`

- `principal`
- `admin`

### `DELETE /api/v1/scholarship/reverse/:txnId`

- `principal`
- `admin`

## 7. Ownership Rules for Student Role

These are mandatory.

### 7.1 Student Profile Ownership

If `req.user.role === "student"`:

- `GET /students/:id` must only return the record where `:id === req.user.student_id`
- else return `403`

### 7.2 Fee Ledger Ownership

If `req.user.role === "student"`:

- `GET /students/:id/fee-ledger` must only allow `:id === req.user.student_id`

### 7.3 Transaction Ownership

If `req.user.role === "student"`:

- `GET /students/:id/transactions` must only allow `:id === req.user.student_id`
- `GET /students/:id/transactions/:txn_id` must verify both:
  - `:id === req.user.student_id`
  - transaction belongs to the same student

### 7.4 Scholarship Ownership

If `req.user.role === "student"`:

- `POST /scholarship/application/submit` must always resolve student identity from token/session
- `GET /scholarship/application/me` must always resolve from token/session

## 8. Error Contract

The backend must return stable authorization failures.

### 8.1 Unauthorized

Use `401` when:

- access token missing
- access token invalid
- access token expired
- refresh token invalid/expired

### 8.2 Forbidden

Use `403` when:

- authenticated role lacks permission
- `student` attempts to access another student's resource

### 8.3 Response Shape

Authorization failures should remain compatible with the current backend error envelope:

```json
{
  "success": false,
  "error": {
    "message": "Forbidden",
    "code": "FORBIDDEN",
    "statusCode": 403,
    "timestamp": "2026-04-18T12:00:00.000Z",
    "requestId": "req_xxx"
  }
}
```

## 9. Backend Implementation Phases

Implementation should happen in this order.

### Phase 1: Identity Foundation

- Add `student_id` to JWT payload generation
- Add `student_id` to `req.user` in `verifyAccessToken`
- Centralize any user-to-student mapping helpers

### Phase 2: Middleware Layer

- Keep `authorizeRoles`
- Add student ownership middleware/helpers
- Add reusable staff-vs-student scoped authorization helpers

### Phase 3: Route Protection

Apply role middleware to:

- `userManagementRoutes.js`
- `departmentRoutes.js`
- `courseRoutes.js`
- `batchRoutes.js`
- `studentRoutes.js`
- `transactionRoutes.js`
- `scholarshipRoutes.js`

### Phase 4: Service/Query Hardening

Verify services and models do not trust caller-provided IDs for `student` role.

Must review at minimum:

- `paymentService.js`
- `studentService.js`
- `scholarshipService.js`
- any model methods that fetch by raw `student_id`

### Phase 5: Optional Self-Service Endpoint Cleanup

To simplify frontend integration later, consider adding:

- `GET /api/v1/students/me`
- `GET /api/v1/students/me/fee-ledger`
- `GET /api/v1/students/me/transactions`

This is optional for backend implementation, but recommended.

## 10. Non-Goals for This Backend Phase

This backend phase does not require frontend changes yet.

Do not treat these as blockers for backend RBAC implementation:

- frontend nav hiding
- frontend button disabling
- frontend route cleanup

Those should be aligned after backend RBAC is implemented and stable.

## 11. Final Implementation Notes

- Backend permissions override any existing frontend assumptions.
- If the frontend currently allows an action that this document forbids, the backend must still reject it.
- Once backend implementation is complete, frontend role guards, hidden modules, and disabled actions should be aligned to this file.

