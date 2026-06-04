# Timesheet Management System

A comprehensive, production-ready timesheet management system for construction projects with automatic OT calculation, approval workflows, and financial tracking.

## Features

### Panel 1: Project Dashboard
- Real-time financial overview of all projects
- Color-coded budget status (Green < 95%, Yellow 95-100%, Red > 100%)
- Track labor budget, spending, overhead, and remaining budget
- View total hours, OT hours, current week progress
- Quick ticket summaries (regular, OT, pending, approved)

### Panel 2: Timesheet Management
- Weekly timesheet entry for multiple employees and projects
- Automatic OT calculation (Hours 1-40 = Regular, 41+ = OT)
- Supervisor submission and Admin approval workflow
- Support for draft saves and multi-edit capabilities
- Row-level editing with real-time calculations
- Status tracking (Draft → Pending → Approved/Rejected)

### Additional Features
- Professional Excel export with multiple sheets (Summary, Per-Project, All-Projects)
- Employee and Project management
- Role-based access control (Admin vs Supervisor)
- JWT-based authentication
- Mobile-responsive design
- Real-time calculations all performed server-side (zero formula errors)

## Project Structure

```
timesheet-tracker/
├── backend/
│   ├── src/
│   │   ├── index.ts                 # Server entry point
│   │   ├── database/
│   │   │   ├── connection.ts        # Database connection pool
│   │   │   └── schema.sql           # Database schema
│   │   ├── models/
│   │   │   └── index.ts             # TypeScript interfaces
│   │   ├── middleware/
│   │   │   └── auth.ts              # JWT authentication
│   │   ├── controllers/
│   │   │   ├── authController.ts    # Authentication logic
│   │   │   ├── timesheetController.ts
│   │   │   ├── projectController.ts
│   │   │   ├── employeeController.ts
│   │   │   └── exportController.ts
│   │   ├── routes/
│   │   │   └── index.ts             # API route definitions
│   │   └── utils/
│   │       └── calculations.ts      # OT & financial calculations
│   ├── tsconfig.json
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── index.tsx               # React entry point
│   │   ├── App.tsx                 # Main app component
│   │   ├── types/
│   │   │   └── index.ts            # TypeScript types
│   │   ├── services/
│   │   │   └── api.ts              # API client
│   │   ├── hooks/
│   │   │   └── useAuth.ts          # Authentication hook
│   │   ├── components/
│   │   │   ├── Layout.tsx          # Main layout
│   │   │   └── ProjectCard.tsx     # Project display card
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── Dashboard.tsx       # Panel 1: Project overview
│   │   │   ├── TimesheetPage.tsx   # Panel 2: Timesheet entry
│   │   │   ├── ExportPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── styles/
│   │   │   └── index.css
│   │   └── index.tsx
│   ├── public/
│   │   └── index.html
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── package.json
│   └── .env.example
│
└── README.md
```

## Tech Stack

### Backend
- **Framework**: Express.js 4.18
- **Language**: TypeScript 5.1
- **Database**: PostgreSQL 13+
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs
- **Excel Export**: ExcelJS 4.3
- **CORS**: Enabled for frontend

### Frontend
- **Framework**: React 18
- **Language**: TypeScript 5.1
- **Routing**: React Router 6
- **HTTP Client**: Axios
- **Styling**: Tailwind CSS 3.3
- **Date Utils**: date-fns 2.30
- **Charts**: Recharts 2.7 (ready for future use)

## Installation & Setup

### Prerequisites
- Node.js 16+ and npm
- PostgreSQL 13+
- Git

### Backend Setup

1. Install dependencies
```bash
cd backend
npm install
```

2. Create `.env` file
```bash
cp .env.example .env
```

3. Configure database in `.env`
```
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=timesheet_tracker
PORT=5000
JWT_SECRET=your-secret-key-change-in-production
```

4. Create PostgreSQL database
```sql
CREATE DATABASE timesheet_tracker;
```

5. Start the backend
```bash
npm run dev
```

The server will initialize the database schema automatically on startup.

### Frontend Setup

1. Install dependencies
```bash
cd frontend
npm install
```

2. Create `.env` file
```bash
cp .env.example .env
```

3. Configure API URL in `.env`
```
REACT_APP_API_URL=http://localhost:5000/api
```

4. Start the frontend
```bash
npm start
```

The app will open at `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register new user
- `GET /api/auth/me` - Get current user

### Timesheets
- `POST /api/timesheets` - Create new timesheet
- `GET /api/timesheets` - List timesheets
- `GET /api/timesheets/:id` - Get timesheet details
- `PATCH /api/timesheets/:id` - Update timesheet rows
- `POST /api/timesheets/:id/submit` - Submit for approval
- `POST /api/timesheets/:id/approve` - Approve (admin only)
- `POST /api/timesheets/:id/reject` - Reject (admin only)
- `DELETE /api/timesheets/rows/:rowId` - Delete row

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project (admin only)
- `GET /api/projects/:id` - Get project details
- `GET /api/projects/summaries/all` - Get all project summaries for dashboard
- `PATCH /api/projects/:id` - Update project (admin only)

### Employees
- `GET /api/employees` - List employees
- `POST /api/employees` - Create employee
- `PATCH /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee

### Export
- `GET /api/export/excel?week=YYYY-MM-DD` - Export timesheets to Excel

## Demo Login Credentials

```
Admin:
  Email: admin@example.com
  Password: password123

Supervisor:
  Email: supervisor@example.com
  Password: password123
```

### Adding Demo Data

You can seed initial data by making API calls:

```bash
# Create sample projects
curl -X POST http://localhost:5000/api/projects \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Project A","labor_budget":50000,"overhead_percentage":20}'

# Create sample employees
curl -X POST http://localhost:5000/api/employees \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","hourly_rate":50,"position":"Carpenter"}'
```

## Workflow

### Supervisor Workflow
1. Login with supervisor credentials
2. Go to Timesheets tab
3. Select or create timesheet for current week
4. Add/edit employee hours for each project
5. Save as draft or submit for approval
6. Wait for admin approval
7. View OT calculation automatically

### Admin Workflow
1. Login with admin credentials
2. View Project Dashboard - see all projects' financial status
3. Go to Timesheets - view pending approvals
4. Review employee hours and totals
5. Approve or reject with optional reason
6. Export timesheets to Excel for reporting
7. Manage employees and projects in Settings

## Key Calculations

### OT Calculation
- Sum all hours across projects for each employee per week
- Hours 1-40: Regular rate
- Hours 41+: 1.5x regular rate (overtime)
- All calculations performed server-side for accuracy

### Project Financial Summary
- Total Spent = Sum of all approved tickets
- Overhead = Total Spent × Overhead % (typically 20%)
- Total with Overhead = Total Spent + Overhead
- Remaining = Labor Budget - Total with Overhead
- % Spent = (Total with Overhead / Labor Budget) × 100
- Status Color:
  - Green: < 95% spent (on budget)
  - Yellow: 95-100% spent (warning)
  - Red: > 100% spent (over budget)

## Excel Export Format

The export includes three sheets:

### 1. Summary Sheet
- Overview of all projects for the week
- Total hours, regular, OT per project
- Total spent and status
- TOTAL row for all projects combined

### 2. Per-Project Sheets
- One sheet per project
- Employee names, hours by day (Mon-Sun)
- Total hours per employee
- Amount per employee
- TOTAL row per project

### 3. All Projects Sheet
- Consolidated view of all projects
- Project name, supervisor, employee count
- Hours breakdown (total, regular, OT)
- Amount per project
- TOTAL row

## Security

- JWT tokens expire after 24 hours
- Passwords hashed with bcryptjs (10 salt rounds)
- Role-based access control (Admin/Supervisor)
- Database connection pooling
- Input validation on all endpoints
- CORS configured for frontend

## Performance

- Database connection pooling (pg Pool)
- Indexed queries on frequently accessed fields
- Server-side calculations prevent formula errors
- Efficient OT recalculation only when needed
- Pagination-ready API structure

## Future Enhancements

- Mobile app (React Native)
- Advanced reporting and analytics
- Payroll integration
- Real-time notifications
- Bulk import/export
- Custom approval workflows
- Equipment/resource tracking
- Budget variance analysis
- Multi-language support

## Deployment

### Backend Deployment
```bash
# Build
npm run build

# Start
npm start
```

### Frontend Deployment
```bash
# Build
npm run build

# Deploy dist folder to static hosting (Vercel, Netlify, AWS S3, etc.)
```

### Environment Variables (Production)
- Change JWT_SECRET to secure random value
- Use production database credentials
- Set NODE_ENV=production
- Configure CORS_ORIGIN for your domain

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check .env credentials
- Verify database exists
- Check network connectivity

### API Errors
- Check browser console for error details
- Review server logs
- Verify JWT token is valid
- Check request headers

### Frontend Issues
- Clear browser cache and localStorage
- Check REACT_APP_API_URL in .env
- Verify backend is running
- Test API endpoints with curl/Postman

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review API endpoint documentation
3. Check browser console and server logs
4. Verify all environment variables are set correctly

## License

Proprietary - All rights reserved

---

Built with TypeScript, React, Express, and PostgreSQL
