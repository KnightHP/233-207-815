# 🏛️ Hostel Management System

**React frontend + Node.js/Express backend + MongoDB Atlas.**
OOP domain model with classic design patterns (Singleton, Factory, Observer, State, MVC).

## ⚠️ Important: Atlas network access

Before running, you **must** let Atlas accept connections from your machine, or
the TLS handshake will be rejected (`SSL alert 80 internal_error`).

1. Go to https://cloud.mongodb.com → your cluster.
2. **Network Access** (left sidebar) → **Add IP Address**.
3. Click **Allow Access From Anywhere** → Confirm (adds `0.0.0.0/0`, fine for demos).
4. Make sure the cluster isn't **paused** (Database → Resume).

If you ever change networks, repeat step 2 or trust the cluster to whatever you're on.

## ▶️ Run

Open two terminals.

**Terminal 1 — backend**
```bash
cd server
npm install
node seed.js        # one-time: creates users + 20 rooms in Atlas
node server.js      # starts API on http://localhost:5000
```

**Terminal 2 — frontend**
```bash
cd frontend
npm install
npm run dev         # opens http://localhost:5173
```

Vite proxies `/api/*` → `http://localhost:5000`, so no CORS config is needed.

## 🔑 Demo accounts

| Role    | Email                | Password     |
|---------|----------------------|--------------|
| Student | student@hostel.com   | student123   |
| Warden  | warden@hostel.com    | warden123    |
| Admin   | admin@hostel.com     | admin123     |

## 🧱 Architecture

```
server/                 Node.js + Express + MongoDB (port 5000)
 ├─ server.js           OOP domain + routes (Singleton / Factory / Observer / State / MVC)
 ├─ seed.js             Inserts demo users + rooms
 ├─ .env                MONGO_URI + DB_NAME
 └─ package.json

frontend/               React + Vite (port 5173)
 └─ src/
     ├─ api.js                      fetch-based client (/api/...)
     ├─ App.jsx                     Router + role-based shell
     ├─ styles.css                  Modern glassmorphism dark UI
     └─ pages/
         ├─ Login.jsx
         ├─ StudentDashboard.jsx    Room tracker, complaints, payments
         ├─ WardenDashboard.jsx     Allocate rooms, advance complaint states
         ├─ AdminDashboard.jsx      Stats, patterns, live event feed
         ├─ Rooms.jsx
         ├─ Complaints.jsx
         └─ Payments.jsx
```

### Design patterns (server/server.js)

| Pattern   | Class                           | Purpose                                 |
|-----------|---------------------------------|-----------------------------------------|
| Singleton | `DatabaseFactory`               | One `MongoClient` per process           |
| Factory   | `User.create` / `col()`         | Produces Student/Warden/Admin + collection handles |
| Observer  | `NotificationService`           | Publishes + persists domain events      |
| State     | `Complaint`                     | Enforces lifecycle transitions          |
| MVC       | Express routes                  | Controllers delegating to domain models |

### Domain classes

`User` → `Student`, `Warden`, `Admin` · `Room` · `Complaint` · `Payment` ·
`RoomAllocationEngine` · `NotificationService` · `DatabaseFactory`

### Complaint state machine

```
submitted → under_review → assigned → in_progress → resolved
```

## 🎬 Demo flow

1. Sign in as **Student** → Apply for a room → see 4-step tracker.
2. Sign out, sign in as **Warden** → pending application appears → pick a room (or auto-pick) → **Allocate**.
3. Back to **Student** → room appears on dashboard → raise a complaint.
4. Back to **Warden** → click *Advance* to walk complaint through all 5 states.
5. **Student** → pay hostel fee.
6. **Admin Dashboard** → stats, revenue, design-patterns card, live event feed from the Observer.

## 🔌 Selected API

| Method | Endpoint                              | Role           |
|--------|---------------------------------------|----------------|
| POST   | `/api/auth/register`                  | public         |
| POST   | `/api/auth/login`                     | public         |
| GET    | `/api/rooms`                          | any            |
| POST   | `/api/rooms`                          | warden/admin   |
| POST   | `/api/applications`                   | student        |
| GET    | `/api/applications`                   | warden/admin   |
| POST   | `/api/applications/:id/allocate`      | warden/admin   |
| POST   | `/api/complaints`                     | student        |
| GET    | `/api/complaints`                     | any (filtered) |
| POST   | `/api/complaints/:id/advance`         | warden/admin   |
| POST   | `/api/payments`                       | student        |
| GET    | `/api/student/dashboard`              | student        |
| GET    | `/api/admin/dashboard`                | warden/admin   |
| GET    | `/api/meta/patterns`                  | public         |
| GET    | `/api/health`                         | public (Mongo ping) |

Auth is passed via `X-User-Id` header (simple demo auth).
