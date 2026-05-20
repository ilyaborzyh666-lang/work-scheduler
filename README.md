# Work Scheduler

A full-stack work scheduling application built for managing employee shifts, leave requests, and notifications across a healthcare-style organization.

## What it does

Employees log in and view their shifts, submit leave requests, and receive real-time notifications when shifts are approved or rejected. Managers and shift managers can approve/reject shifts and leaves, manage their team, and loan employees to other shift managers. The app enforces business rules such as a 60-hour weekly cap, minimum 8-hour rest between shifts, and shift capacity limits per type.

## Architecture

```
WorkScheduler/
├── src/                        # React Native (Expo) frontend
│   ├── context/AuthContext.tsx  # Global auth state via Firebase Auth
│   ├── navigation/              # Stack + Bottom Tab navigator
│   ├── screens/                 # One folder per feature
│   │   ├── auth/                # Login, Register
│   │   ├── dashboard/           # Calendar view of shifts
│   │   ├── shifts/              # Shift list, approve/reject
│   │   ├── employees/           # Team management
│   │   ├── leaves/              # Leave requests
│   │   └── notifications/       # Real-time notifications
│   ├── services/                # Firebase + API calls (one file per domain)
│   ├── types/index.ts           # All shared types and business rule constants
│   ├── i18n/                    # Hebrew + English translations
│   └── utils/                   # Date helpers, responsive sizing
├── backend/                    # Python FastAPI backend
│   ├── main.py                  # App entry, CORS, router registration
│   ├── routes/                  # shifts.py, leaves.py, employees.py
│   ├── services/                # Business logic layer
│   ├── auth.py                  # Firebase Admin token verification
│   └── models.py                # Pydantic request/response models
└── assets/                     # App icons and splash screen
```

### Tech stack

| Layer | Technology |
|---|---|
| Frontend | React Native + Expo (web, Android, iOS) |
| Backend | Python FastAPI |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| Navigation | React Navigation (stack + bottom tabs) |
| i18n | i18next (Hebrew / English) |

### User roles

| Role | Permissions |
|---|---|
| `ceo` | Full access to everything |
| `manager` | Manage all employees and shifts |
| `shift_manager` | Manage their own team, loan employees |
| `doctor` / `nurse` / `caregiver` | View own shifts, submit leave requests |

### Business rules (enforced in code)

- Max **60 hours/week** per employee
- Minimum **8 hours rest** between shifts
- Shift capacity: morning ≤ 6, afternoon ≤ 4, night ≤ 1
- Short leave (≤ 2 days): 2-day advance notice required
- Long leave (> 2 days): 30-day advance notice required

## Getting started

### Frontend

```bash
cp .env.example .env   # fill in your Firebase credentials
npm install
npx expo start --web
```

### Backend

```bash
cd backend
cp .env.example .env   # fill in Firebase Admin SDK credentials
pip install -r requirements.txt
uvicorn main:app --reload
```

## Environment variables

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```
