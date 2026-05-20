<div align="center">

# 🗓️ Work Scheduler

### The shift management platform built for healthcare teams — from the manager's desk to every caregiver's pocket.

[![React Native](https://img.shields.io/badge/React_Native-Expo_SDK_54-000020?style=flat-square&logo=expo&logoColor=white)](https://expo.dev)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FF6F00?style=flat-square&logo=firebase&logoColor=white)](https://firebase.google.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)

**[Features](#features) · [Architecture](#architecture) · [Quick Start](#quick-start) · [API Reference](#api-reference)**

</div>

---

## The Problem

Running shifts in a healthcare facility means coordinating dozens of people across morning, afternoon, and night rotations — while enforcing rest rules, tracking hours, handling leave requests, and making sure no shift is understaffed.

Most teams still do this in spreadsheets. **Work Scheduler replaces the spreadsheet.**

Managers approve shifts in one tap. Employees see their schedule the moment it's published. Leave requests flow through a proper approval chain. And the system automatically enforces every labour rule so no one accidentally works 70 hours a week.

---

## Features

### 👥 Role-based access
- **CEO** — full visibility and control across the entire organisation
- **Manager** — manage all employees and shifts, override rules when needed
- **Shift Manager** — manage their own team, loan employees to other managers
- **Doctors / Nurses / Caregivers** — view their schedule, submit leave requests

### 📅 Shift management
- Morning, afternoon, and night rotations with fixed hours
- Capacity limits enforced automatically (morning ≤ 6, afternoon ≤ 4, night ≤ 1)
- Approve or reject shifts with real-time notification to the employee
- Employee loan system — shift managers can temporarily share staff

### 🏖️ Leave requests
- Short leave (≤ 2 days): 2-day advance notice required
- Long leave (> 2 days): 30-day advance notice required
- Full approval/rejection flow with push notification on decision

### 🔔 Real-time notifications
- Live badge count on the notifications tab
- Alerts for shift approval/rejection, leave approval/rejection, and hours limit warnings
- Built on Firestore `onSnapshot` — updates appear instantly without polling

### 🌍 Bilingual
- Full Hebrew and English support via i18next
- Toggle language at any time from the app header

### 🛡️ Business rule enforcement
- 60-hour weekly cap per employee
- Minimum 8 hours rest between consecutive shifts
- Automatic blocking with manager override capability

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              React Native (Expo) — Web / iOS / Android  │
│                                                         │
│  LoginScreen  RegisterScreen  DashboardScreen           │
│  ShiftsScreen  EmployeesScreen  LeavesScreen            │
│  NotificationsScreen                                    │
└──────────────┬──────────────────────┬───────────────────┘
               │ onSnapshot (realtime)│ HTTPS / JSON
               ▼                      ▼
┌──────────────────────┐  ┌──────────────────────────────┐
│   Firebase           │  │   FastAPI Backend (Python)   │
│                      │  │                              │
│  Firestore           │  │  /shifts                     │
│  ├── users           │  │  /leaves                     │
│  ├── shifts          │  │  /employees                  │
│  ├── leaveRequests   │  │                              │
│  ├── notifications   │  │  auth.py  — Firebase Admin   │
│  └── loanRequests    │  │  services/ — business logic  │
│                      │  │  models/  — Pydantic schemas │
│  Firebase Auth       │  └──────────────────────────────┘
└──────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native · Expo SDK 54 · TypeScript |
| Navigation | React Navigation (Stack + Bottom Tabs) |
| Backend | Python · FastAPI |
| Database | Firebase Firestore (real-time) |
| Auth | Firebase Authentication |
| i18n | i18next (Hebrew + English) |
| Notifications | Expo Push Notifications + Firestore listeners |

---

## User Roles

| Role | Can approve shifts | Can manage employees | Can loan staff |
|------|:-----------------:|:-------------------:|:--------------:|
| `ceo` | ✅ | ✅ | ✅ |
| `manager` | ✅ | ✅ | ✅ |
| `shift_manager` | ✅ (own team) | ✅ (own team) | ✅ |
| `doctor` / `nurse` / `caregiver` | ❌ | ❌ | ❌ |

---

## Business Rules

| Rule | Value |
|------|-------|
| Max weekly hours | 60 h |
| Min rest between shifts | 8 h |
| Morning shift capacity | 6 employees |
| Afternoon shift capacity | 4 employees |
| Night shift capacity | 1 employee |
| Short leave notice | 2 days |
| Long leave notice | 30 days |

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| Python | 3.11+ |
| Expo Go | Latest |
| Firebase project | (free tier works) |

### 1. Frontend

```bash
git clone https://github.com/ilyaborzyh666-lang/work-scheduler.git
cd work-scheduler

npm install

cp .env.example .env
# Fill in your Firebase credentials (see Environment Variables below)

npx expo start --web
```

### 2. Backend

```bash
cd backend

pip install -r requirements.txt

cp .env.example .env
# Fill in Firebase Admin SDK credentials

uvicorn main:app --reload
```

> API docs: **http://localhost:8000/docs**

### Environment Variables

```env
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

---

## API Reference

<details>
<summary>View all endpoints</summary>

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/health` | — | Health check |
| `GET` | `/shifts` | ✓ | List shifts (filtered by role) |
| `POST` | `/shifts` | ✓ | Create shift |
| `PATCH` | `/shifts/{id}` | ✓ | Approve / reject shift |
| `GET` | `/leaves` | ✓ | List leave requests |
| `POST` | `/leaves` | ✓ | Submit leave request |
| `PATCH` | `/leaves/{id}` | ✓ | Approve / reject leave |
| `GET` | `/employees` | ✓ | List employees (manager/ceo only) |
| `PATCH` | `/employees/{id}` | ✓ | Block / unblock employee |

</details>

---

## Project Structure

```
work-scheduler/
├── src/
│   ├── context/
│   │   └── AuthContext.tsx       ← Global auth state (Firebase onAuthStateChanged)
│   ├── navigation/
│   │   └── AppNavigator.tsx      ← Stack + Tab navigator, role-based tab visibility
│   ├── screens/
│   │   ├── auth/                 ← Login, Register
│   │   ├── dashboard/            ← Calendar view of shifts
│   │   ├── shifts/               ← Shift list, approve/reject, loan system
│   │   ├── employees/            ← Team management, block/unblock
│   │   ├── leaves/               ← Leave request flow
│   │   └── notifications/        ← Real-time notification feed
│   ├── services/
│   │   ├── firebase.ts           ← Firestore + Auth init
│   │   ├── authService.ts        ← Login, logout, profile fetch
│   │   ├── shiftService.ts       ← Shift CRUD + approval
│   │   ├── leaveService.ts       ← Leave CRUD + approval
│   │   ├── userService.ts        ← User management
│   │   └── loanService.ts        ← Employee loan system
│   ├── types/index.ts            ← All shared types + business rule constants
│   ├── i18n/                     ← he.ts + en.ts translations
│   └── utils/                    ← Date helpers, responsive sizing
├── backend/
│   ├── main.py                   ← FastAPI app, CORS, router registration
│   ├── auth.py                   ← Firebase Admin token verification
│   ├── models.py                 ← Pydantic request/response models
│   ├── routes/
│   │   ├── shifts.py
│   │   ├── leaves.py
│   │   └── employees.py
│   └── services/
│       ├── shift_service.py      ← Business logic + rule enforcement
│       └── leave_service.py
└── assets/                       ← Icons, splash screen
```

---

## License

MIT © 2025
