# Complete Setup Guide

## Quick Start (5 minutes)

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

The server will:
- Initialize PostgreSQL database automatically
- Create all tables from schema.sql
- Start on http://localhost:5000
- Be ready to accept requests

### 2. Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm start
```

The app will open at http://localhost:3000

### 3. Login

Use demo credentials:
- Email: `admin@example.com`
- Password: `password123`

Or register your own account.

---

## Detailed Setup Steps

### Prerequisites

#### macOS
```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node

# Install PostgreSQL
brew install postgresql@15
brew services start postgresql@15
```

#### Ubuntu/Linux
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl start postgresql
```

#### Windows
- Download Node.js from https://nodejs.org/
- Download PostgreSQL from https://www.postgresql.org/download/windows/
- Install both with default options

### Verify Installation

```bash
node --version  # Should be 16+
npm --version   # Should be 8+
psql --version  # Should show PostgreSQL version
```

---

## Backend Configuration

### 1. Environment Variables

Create `backend/.env`:

```env
# Database
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=timesheet_tracker

# Server
PORT=5000
NODE_ENV=development

# JWT
JWT_SECRET=dev-secret-key-change-in-production

# CORS
CORS_ORIGIN=http://localhost:3000
```

### 2. Database Setup

The database is created automatically, but you can set it up manually:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE timesheet_tracker;
CREATE USER timesheet_user WITH PASSWORD 'password123';
GRANT ALL PRIVILEGES ON DATABASE timesheet_tracker TO timesheet_user;

# Exit psql
\q
```

Then update `.env` with these credentials.

### 3. Install & Start Backend

```bash
cd backend
npm install

# Start development server
npm run dev

# Or build for production
npm run build
npm start
```

You should see:
```
Server running on port 5000
Database initialized successfully
```

### 4. Test Backend

```bash
# Test health endpoint
curl http://localhost:5000/health

# Test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

---

## Frontend Configuration

### 1. Environment Variables

Create `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ENV=development
```

### 2. Install & Start Frontend

```bash
cd frontend
npm install
npm start
```

The app will open at `http://localhost:3000`

### 3. Build for Production

```bash
npm run build

# Output in frontend/build/
# Ready to deploy to hosting service
```

---

## Creating Demo Data

### Option 1: Using API (Recommended)

1. Login at http://localhost:3000
2. Go to Settings tab
3. Add employees and projects through the UI

### Option 2: Using curl

```bash
# Get token first
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}' | jq -r '.token')

# Create project
curl -X POST http://localhost:5000/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Office Building",
    "labor_budget":50000,
    "overhead_percentage":20
  }'

# Create employee
curl -X POST http://localhost:5000/api/employees \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"John Smith",
    "hourly_rate":50,
    "position":"Carpenter"
  }'
```

### Option 3: Direct Database Insert

```bash
psql -U postgres -d timesheet_tracker

-- Create sample supervisor
INSERT INTO users (email, password_hash, role, company_name)
VALUES ('supervisor@example.com', '$2a$10$...', 'supervisor', 'ABC Construction');

-- Create sample project
INSERT INTO projects (name, labor_budget, overhead_percentage, status)
VALUES ('Project A', 50000, 20, 'active');

-- Create sample employee
INSERT INTO employees (name, supervisor_id, hourly_rate, position)
VALUES ('John Doe', 1, 50.00, 'Carpenter');
```

---

## Stopping Services

```bash
# Stop PostgreSQL (macOS)
brew services stop postgresql@15

# Stop PostgreSQL (Linux)
sudo systemctl stop postgresql

# Stop Node.js servers
Ctrl+C in terminal windows
```

---

## Troubleshooting

### PostgreSQL Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

Solution:
```bash
# Check if PostgreSQL is running
ps aux | grep postgres

# Start PostgreSQL (if not running)
brew services start postgresql@15  # macOS
sudo systemctl start postgresql     # Linux

# Test connection
psql -U postgres
```

### Port Already in Use

```
Error: listen EADDRINUSE :::5000
```

Solution:
```bash
# Find process using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>

# Or use different port
PORT=5001 npm run dev
```

### Module Not Found

```
Error: Cannot find module 'express'
```

Solution:
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Database Not Found

```
error: database "timesheet_tracker" does not exist
```

Solution:
```bash
# Create database manually
psql -U postgres -c "CREATE DATABASE timesheet_tracker;"
```

### JWT Token Errors

```
Error: Invalid or expired token
```

Solution:
- Logout and login again
- Clear localStorage: `localStorage.clear()` in browser console
- Check JWT_SECRET in .env matches between sessions

---

## Verification Checklist

After setup, verify everything works:

- [ ] Backend starts without errors
- [ ] Frontend loads at localhost:3000
- [ ] Can login with demo credentials
- [ ] Dashboard shows "No active projects" (or any projects you added)
- [ ] Can navigate to Timesheets, Export, Settings
- [ ] Can create new project in Settings
- [ ] Can create new employee in Settings
- [ ] Can create timesheet and enter hours
- [ ] Hours calculation works automatically
- [ ] Can export to Excel

---

## Development Workflow

### During Development

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

Both will auto-reload on file changes (hot reload).

### Useful Commands

```bash
# Check all running processes
ps aux | grep node
ps aux | grep postgres

# View server logs
tail -f backend/logs/app.log

# Reset database
psql -U postgres -d timesheet_tracker -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Test API endpoint
curl -H "Authorization: Bearer TOKEN" http://localhost:5000/api/timesheets
```

---

## Production Deployment

### Backend (Heroku Example)

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create timesheet-tracker-api

# Set environment variables
heroku config:set JWT_SECRET=production-secret-key
heroku config:set DB_PASSWORD=production-password

# Deploy
git push heroku main
```

### Frontend (Vercel Example)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel

# Set environment variable
vercel env add REACT_APP_API_URL https://api.example.com
```

---

## Next Steps

1. Review README.md for feature overview
2. Explore the codebase structure
3. Make your first timesheet entry
4. Test the approval workflow
5. Export data to Excel
6. Customize for your company
7. Deploy to production

---

For detailed API documentation, see README.md
