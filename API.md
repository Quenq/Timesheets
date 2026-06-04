# API Documentation

Complete reference for all Timesheet Management System endpoints.

## Base URL

```
http://localhost:5000/api
```

## Authentication

All endpoints (except `/auth/login` and `/auth/register`) require a JWT token in the Authorization header:

```
Authorization: Bearer YOUR_TOKEN_HERE
```

Tokens expire after 24 hours.

---

## Authentication Endpoints

### POST /auth/login

Login with email and password.

**Request:**
```json
{
  "email": "supervisor@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "supervisor@example.com",
    "role": "supervisor"
  }
}
```

**Errors:**
- `400 Bad Request` - Missing email or password
- `401 Unauthorized` - Invalid credentials

---

### POST /auth/register

Register a new user account.

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "securepassword",
  "role": "supervisor",
  "company_name": "ABC Construction"
}
```

**Response (201 Created):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "email": "newuser@example.com",
    "role": "supervisor"
  }
}
```

**Errors:**
- `400 Bad Request` - Missing required fields
- `409 Conflict` - Email already exists

---

### GET /auth/me

Get current authenticated user info.

**Response (200 OK):**
```json
{
  "id": 1,
  "email": "supervisor@example.com",
  "role": "supervisor",
  "company_name": "ABC Construction"
}
```

**Errors:**
- `401 Unauthorized` - No token provided
- `403 Forbidden` - Invalid token

---

## Timesheet Endpoints

### POST /timesheets

Create a new timesheet (draft).

**Request:**
```json
{
  "week_start_date": "2026-04-20",
  "rows": [
    {
      "employee_id": 1,
      "project_id": 1,
      "monday": 8,
      "tuesday": 8,
      "wednesday": 8,
      "thursday": 8,
      "friday": 8,
      "saturday": 0,
      "sunday": 0
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "id": 5,
  "status": "draft"
}
```

**Errors:**
- `400 Bad Request` - Missing week_start_date
- `403 Forbidden` - Non-supervisors cannot create
- `404 Not Found` - Employee or project not found

---

### GET /timesheets

List all timesheets (filtered by role).

**Query Parameters:**
- None

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "week_start_date": "2026-04-20",
    "supervisor_id": 1,
    "status": "approved",
    "submitted_at": "2026-04-21T10:00:00Z",
    "approved_at": "2026-04-21T15:00:00Z",
    "created_at": "2026-04-20T08:00:00Z"
  },
  {
    "id": 2,
    "week_start_date": "2026-04-27",
    "supervisor_id": 1,
    "status": "pending",
    "submitted_at": "2026-04-28T09:00:00Z",
    "approved_at": null,
    "created_at": "2026-04-27T08:00:00Z"
  }
]
```

**Notes:**
- Supervisors see only their own timesheets
- Admins see all timesheets

---

### GET /timesheets/:id

Get specific timesheet with all rows and OT calculations.

**Response (200 OK):**
```json
{
  "timesheet": {
    "id": 1,
    "week_start_date": "2026-04-20",
    "supervisor_id": 1,
    "status": "approved",
    "submitted_at": "2026-04-21T10:00:00Z",
    "approved_at": "2026-04-21T15:00:00Z",
    "created_at": "2026-04-20T08:00:00Z"
  },
  "rows": [
    {
      "id": 10,
      "timesheet_id": 1,
      "employee_id": 1,
      "project_id": 1,
      "employee_name": "John Smith",
      "project_name": "Office Building",
      "monday": 8,
      "tuesday": 8,
      "wednesday": 8,
      "thursday": 8,
      "friday": 8,
      "saturday": 0,
      "sunday": 0,
      "total_hours": 40
    }
  ],
  "ot_calculations": [
    {
      "id": 1,
      "timesheet_id": 1,
      "employee_id": 1,
      "total_hours": 40,
      "regular_hours": 40,
      "ot_hours": 0
    }
  ]
}
```

**Errors:**
- `404 Not Found` - Timesheet not found
- `403 Forbidden` - Not authorized

---

### PATCH /timesheets/:id

Update timesheet rows.

**Request:**
```json
{
  "rows": [
    {
      "id": 10,
      "employee_id": 1,
      "project_id": 1,
      "monday": 9,
      "tuesday": 8,
      "wednesday": 8,
      "thursday": 8,
      "friday": 8,
      "saturday": 0,
      "sunday": 0
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Notes:**
- Total hours automatically calculated
- OT recalculated on save
- Can edit rows until approved

---

### POST /timesheets/:id/submit

Submit timesheet for approval (changes status to pending).

**Response (200 OK):**
```json
{
  "success": true
}
```

**Errors:**
- `403 Forbidden` - Only supervisors can submit
- `404 Not Found` - Timesheet not found

---

### POST /timesheets/:id/approve

Approve a timesheet (admin only, changes status to approved).

**Response (200 OK):**
```json
{
  "success": true
}
```

**Errors:**
- `403 Forbidden` - Only admins can approve
- `404 Not Found` - Timesheet not found

---

### POST /timesheets/:id/reject

Reject a timesheet with optional reason.

**Request:**
```json
{
  "rejection_reason": "Hours exceed project budget"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

**Errors:**
- `403 Forbidden` - Only admins can reject
- `404 Not Found` - Timesheet not found

---

### DELETE /timesheets/rows/:rowId

Delete a timesheet row.

**Response (200 OK):**
```json
{
  "success": true
}
```

---

## Project Endpoints

### GET /projects

List all active projects.

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "Office Building",
    "labor_budget": 50000,
    "overhead_percentage": 20,
    "status": "active",
    "created_at": "2026-04-01T08:00:00Z"
  },
  {
    "id": 2,
    "name": "Warehouse Renovation",
    "labor_budget": 75000,
    "overhead_percentage": 20,
    "status": "active",
    "created_at": "2026-04-05T08:00:00Z"
  }
]
```

---

### POST /projects

Create a new project (admin only).

**Request:**
```json
{
  "name": "New Office Complex",
  "labor_budget": 100000,
  "overhead_percentage": 20
}
```

**Response (201 Created):**
```json
{
  "id": 3,
  "name": "New Office Complex",
  "labor_budget": 100000,
  "overhead_percentage": 20,
  "status": "active",
  "created_at": "2026-04-20T08:00:00Z"
}
```

**Errors:**
- `403 Forbidden` - Only admins can create
- `400 Bad Request` - Missing name or labor_budget

---

### GET /projects/summaries/all

Get financial summaries for all projects (for dashboard).

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "Office Building",
    "labor_budget": 50000,
    "total_spent": 42500,
    "overhead_amount": 8500,
    "total_with_overhead": 51000,
    "remaining": -1000,
    "percent_spent": 102,
    "total_hours": 850,
    "ot_hours": 120,
    "ot_spent": 7200,
    "current_week_hours": 63,
    "tickets_summary": {
      "regular_tickets": 8,
      "ot_tickets": 2,
      "pending": 1,
      "approved": 9
    }
  }
]
```

---

### GET /projects/:id

Get detailed project financial summary.

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "Office Building",
  "labor_budget": 50000,
  "total_spent": 42500,
  "overhead_amount": 8500,
  "total_with_overhead": 51000,
  "remaining": -1000,
  "percent_spent": 102,
  "total_hours": 850,
  "ot_hours": 120,
  "ot_spent": 7200,
  "current_week_hours": 63,
  "tickets_summary": {
    "regular_tickets": 8,
    "ot_tickets": 2,
    "pending": 1,
    "approved": 9
  }
}
```

---

### PATCH /projects/:id

Update a project (admin only).

**Request:**
```json
{
  "name": "Office Building Phase 2",
  "labor_budget": 60000,
  "overhead_percentage": 25,
  "status": "completed"
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "Office Building Phase 2",
  "labor_budget": 60000,
  "overhead_percentage": 25,
  "status": "completed"
}
```

---

## Employee Endpoints

### GET /employees

List employees for current supervisor.

**Query Parameters:**
- `supervisor_id` (optional, admin only) - Filter by supervisor

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "John Smith",
    "supervisor_id": 1,
    "hourly_rate": 50,
    "position": "Carpenter",
    "created_at": "2026-04-01T08:00:00Z"
  },
  {
    "id": 2,
    "name": "Maria Garcia",
    "supervisor_id": 1,
    "hourly_rate": 55,
    "position": "Lead Carpenter",
    "created_at": "2026-04-02T08:00:00Z"
  }
]
```

---

### POST /employees

Create a new employee.

**Request:**
```json
{
  "name": "Carlos Rodriguez",
  "hourly_rate": 45,
  "position": "Laborer"
}
```

**Response (201 Created):**
```json
{
  "id": 3,
  "name": "Carlos Rodriguez",
  "supervisor_id": 1,
  "hourly_rate": 45,
  "position": "Laborer",
  "created_at": "2026-04-20T08:00:00Z"
}
```

---

### PATCH /employees/:id

Update an employee.

**Request:**
```json
{
  "hourly_rate": 48,
  "position": "Senior Laborer"
}
```

**Response (200 OK):**
```json
{
  "id": 3,
  "name": "Carlos Rodriguez",
  "supervisor_id": 1,
  "hourly_rate": 48,
  "position": "Senior Laborer"
}
```

---

### DELETE /employees/:id

Delete an employee.

**Response (200 OK):**
```json
{
  "success": true
}
```

---

## Export Endpoints

### GET /export/excel

Export timesheets to Excel for a specific week.

**Query Parameters:**
- `week` (required) - Week start date (YYYY-MM-DD format)

**Example:**
```
GET /export/excel?week=2026-04-20
```

**Response:**
- Binary Excel file (.xlsx)
- Filename: `timesheets-2026-04-20.xlsx`

**File Contents:**
- Sheet 1: Summary (all projects overview)
- Sheet 2+: Per-project sheets
- Sheet N: All Projects (consolidated)

**Errors:**
- `403 Forbidden` - Only admins can export
- `400 Bad Request` - Missing week parameter

---

## Error Response Format

All errors follow this format:

```json
{
  "error": "Error message description"
}
```

### HTTP Status Codes

- `200 OK` - Successful GET/PATCH
- `201 Created` - Successful POST
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing/invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `500 Internal Server Error` - Server error

---

## Rate Limits

Currently no rate limiting. For production, consider:
- 100 requests per minute per user
- 1000 requests per minute per IP
- Exponential backoff on retry

---

## API Examples

### Complete Workflow Example

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"supervisor@example.com","password":"password123"}' \
  | jq -r '.token')

# 2. Create timesheet
curl -X POST http://localhost:5000/api/timesheets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "week_start_date":"2026-04-20",
    "rows":[{
      "employee_id":1,
      "project_id":1,
      "monday":8,
      "tuesday":8,
      "wednesday":8,
      "thursday":8,
      "friday":8,
      "saturday":0,
      "sunday":0
    }]
  }'

# 3. Submit timesheet (id = 1)
curl -X POST http://localhost:5000/api/timesheets/1/submit \
  -H "Authorization: Bearer $TOKEN"

# 4. Get projects summary
curl http://localhost:5000/api/projects/summaries/all \
  -H "Authorization: Bearer $TOKEN"

# 5. Export to Excel (admin token required)
curl -X GET http://localhost:5000/api/export/excel?week=2026-04-20 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -o timesheets.xlsx
```

---

## Testing with cURL

### Create a project
```bash
curl -X POST http://localhost:5000/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Test Project",
    "labor_budget":50000,
    "overhead_percentage":20
  }'
```

### Create an employee
```bash
curl -X POST http://localhost:5000/api/employees \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Test Employee",
    "hourly_rate":50,
    "position":"Worker"
  }'
```

### Get timesheets
```bash
curl http://localhost:5000/api/timesheets \
  -H "Authorization: Bearer $TOKEN"
```

---

## Postman Collection

Import this collection into Postman for easy testing:

1. File → Import
2. Paste the JSON below or URL
3. Set `{{token}}` environment variable after login

[See Postman collection in separate file or create in Postman UI]

---

## WebSocket Support

Currently not implemented. Future enhancement for:
- Real-time timesheet updates
- Live approval notifications
- Collaborative editing

---

## Versioning

Current API Version: **v1**
Deprecation Notice: None currently

---

For more information, see README.md
