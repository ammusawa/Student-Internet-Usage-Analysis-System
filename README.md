<img width="1347" height="623" alt="Dashboard" src="https://github.com/user-attachments/assets/51d865e5-3bda-4285-8ddd-41fbc781abc9" />
<img width="1340" height="615" alt="Analysis" src="https://github.com/user-attachments/assets/b16380d1-3de1-4e16-b642-62f4cb9b2cb3" />
<img width="1322" height="593" alt="Access Requests" src="https://github.com/user-attachments/assets/936d47f8-0835-414a-b991-f75efe72b718" />
<img width="1337" height="617" alt="Users" src="https://github.com/user-attachments/assets/a07186db-d7cc-4540-af89-57303c7cd9e3" />
<img width="1352" height="617" alt="Upload Logs" src="https://github.com/user-attachments/assets/3b8d83e8-e356-40c8-a657-21a9c9977b9d" />
<img width="1337" height="611" alt="Traffic" src="https://github.com/user-attachments/assets/8d62c9f9-abd2-4c8c-9020-129ab161b700" />
<img width="737" height="385" alt="Successful Login" src="https://github.com/user-attachments/assets/abc5da5a-5628-468e-80fa-38ec5866d6f2" />
<img width="1355" height="622" alt="Request Approve Successful" src="https://github.com/user-attachments/assets/ac38716e-c92c-4212-b694-940aa3b5ecb3" />
<img width="590" height="421" alt="Register" src="https://github.com/user-attachments/assets/d4eeaaa7-1c53-49fc-a8db-9ea8cc5f3fb5" />
<img width="624" height="467" alt="Register Successful" src="https://github.com/user-attachments/assets/d03348c4-8d9c-4a4a-8236-084d346c12cb" />
<img width="530" height="561" alt="Pending Admin Approval" src="https://github.com/user-attachments/assets/f05077ba-3137-4138-b3c1-05aafa6825fc" />
<img width="781" height="544" alt="Login" src="https://github.com/user-attachments/assets/ef46f52a-3aa3-4a66-a931-4b5ded780023" />
<img width="545" height="542" alt="Incorrect Password" src="https://github.com/user-attachments/assets/090e4e6d-6504-4b42-9bef-b22f925398b5" />
<img width="1341" height="622" alt="Identity" src="https://github.com/user-attachments/assets/a3990aa5-0e75-4f0e-818d-f80ee53c02ca" />
<img width="1343" height="610" alt="Data" src="https://github.com/user-attachments/assets/aed05366-c027-4209-9fc3-404c061d17bc" />
# Student Internet Usage Analysis System

Identity-based internet monitoring and captive-portal control for school networks.

## Overview

This project tracks and controls student internet access by linking traffic to authenticated users (not just changing IP addresses).

It combines:
- A **FastAPI backend** for auth, sessions, analytics, and policy APIs
- A **Next.js frontend** for admin and student dashboards
- A **MySQL database** for users, sessions, traffic logs, and flagged sites
- A **proxy.py plugin** (`backend/app_proxy.py`) for traffic interception, portal redirect, and enforcement

## Key Features

- Role-based users (`admin`, `network_analyst`, `student`, `guest`, `co`)
- Student self-registration with admin approval flow
- Captive portal workflow (`/portal`)
- Session/IP history tracking (`session_ip_assignments`) for reliable identity
- Traffic analytics (top users/sites, trends, per-user insights)
- Admin controls:
  - approve/reject requests
  - disconnect sessions
  - drop user access
  - manage flagged sites
- Data exports/printing with filters (user/site/date range)
- User profile page with editable details and optional profile image

## Project Structure

```text
.
├─ backend/
│  ├─ main.py                 # FastAPI app and APIs
│  ├─ models.py               # SQLAlchemy models
│  ├─ schemas.py              # Pydantic schemas
│  ├─ seed.py                 # DB create/reset + mock seed
│  ├─ app_proxy.py            # proxy.py plugin
│  ├─ start_proxy.py          # starts proxy on 0.0.0.0:8899
│  ├─ schema_full.sql         # full SQL schema
│  ├─ schema_upgrade_only.sql # additive SQL upgrade script
│  └─ .env                    # backend environment
├─ frontend/
│  ├─ src/app/                # Next.js pages (dashboard, portal, auth)
│  └─ package.json
├─ scripts/
│  └─ run-db.mjs              # npm db runner (calls seed.py --reset)
└─ package.json               # root scripts
```

## Prerequisites

- **Node.js** 18+ (recommended)
- **Python** 3.10+ (3.11 recommended)
- **MySQL** 8+

## Installation

### 1) Frontend dependencies

```bash
cd frontend
npm install
```

### 2) Backend dependencies

If you use a virtual environment:

```bash
cd backend
python -m venv venv
# Windows PowerShell:
venv\Scripts\Activate.ps1
# macOS/Linux:
# source venv/bin/activate

pip install fastapi uvicorn sqlalchemy pymysql passlib bcrypt python-jose[cryptography] python-dotenv pandas proxy.py python-multipart
```

> Note: There is no committed `requirements.txt` yet, so the command above installs required packages directly.

## Environment Configuration

Edit `backend/.env` as needed:

```env
DB_USER=root
DB_PASSWORD=""
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=student_usage_db

SECRET_KEY=change_me
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

CAPTIVE_PORTAL_URL=http://<YOUR_LAN_IP>:3000/portal
CAPTIVE_ALLOWED_HOSTS=<YOUR_LAN_IP>,127.0.0.1,localhost
NETWORK_EVENT_SECRET=change_me
```

## Database Setup

From the project root:

```bash
npm run db
```

What this does:
- Creates database if missing
- Drops and recreates all ORM tables
- Seeds complete mock dataset (users, categories, sessions, logs, flagged sites)

Seeded login examples (password for seeded accounts: `password123`):
- `admin`
- `student1`, `student2`, `student3`
- `pending_student`
- `analyst1`

## Running the System

Open **3 terminals**.

### 1) Backend API (FastAPI)

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2) Frontend (Next.js)

```bash
cd frontend
npm run dev
```

Frontend URL:
- `http://localhost:3000`
- or `http://<YOUR_LAN_IP>:3000` for other devices

### 3) Proxy Server

```bash
cd backend
python start_proxy.py
```

Proxy listens on:
- `0.0.0.0:8899`

Configure client devices to use:
- HTTP proxy: `<YOUR_LAN_IP>`
- Port: `8899`

## Typical Workflow

1. Student connects to Wi-Fi and configures proxy.
2. Unauthenticated traffic is redirected to `/portal`.
3. Student registers/logs in.
4. Admin approves access request.
5. Browsing is allowed; traffic is logged and attributed to that user/session.
6. Admin monitors/controls via dashboard pages (`Traffic`, `Analysis`, `Data`, `Users`, `Identity`).

## Main Dashboard Routes

- `/dashboard` - role-aware overview
- `/dashboard/traffic` - traffic overview + per-site user drilldown
- `/dashboard/users` - user management (admin)
- `/dashboard/identity` - session/IP management (admin)
- `/dashboard/access-requests` - pending approvals (admin)
- `/dashboard/analysis` - analytics + flagged sites (admin)
- `/dashboard/data` - filtered logs export/print
- `/dashboard/profile` - user profile update + image upload

## API Highlights

- Auth/Profile: `/login`, `/register`, `/me`, `/me/profile`, `/me/profile-image`
- Portal: `/portal/heartbeat`, `/portal/status`, `/portal/logout`, `/portal/network-event`
- Users: `/users`, `/users/requests`, `/users/{id}/approve`, `/users/{id}/reject`, `/users/{id}/drop-access`
- Metrics: `/metrics/traffic`, `/metrics/my-traffic`, `/metrics/top-users`, `/metrics/top-websites`, `/metrics/trends`
- Data export: `/metrics/logs`, `/metrics/logs/export`
- Policy: `/flagged-sites` (+ activate/deactivate)

## SQL Scripts

- Full fresh schema: `backend/schema_full.sql`
- Upgrade-only schema changes: `backend/schema_upgrade_only.sql`

## Troubleshooting

- **`npm run db` fails**:
  - Ensure MySQL is running and `backend/.env` credentials are correct
  - Ensure Python dependencies are installed
- **CORS errors**:
  - Start backend on `0.0.0.0:8000`
  - Ensure origin/IP is included by CORS settings
- **No traffic visible**:
  - Confirm proxy is running on port `8899`
  - Confirm client device proxy settings point to host LAN IP
- **Portal redirect wrong IP**:
  - Update `CAPTIVE_PORTAL_URL` / `CAPTIVE_ALLOWED_HOSTS` in `.env`

## Security Notes

- Replace example secrets in `.env` before production
- Use HTTPS and production-grade auth/session hardening in real deployments
- Restrict proxy/API access to trusted network segments

## License

No license file is currently included. Add one before public distribution.

