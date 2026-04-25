# Time-Off Microservice

A production-quality time-off management system consisting of a NestJS backend, a standalone mock HCM server, and a React + TypeScript frontend.

## Architecture Overview

```
┌─────────────────┐      HTTP       ┌─────────────────────┐      HTTP       ┌──────────────┐
│   React + Vite  │ ◄────────────► │  NestJS Time-Off    │ ◄────────────► │  Mock HCM    │
│  :5173          │                 │  Service  :3000      │                 │  Server :3001│
└─────────────────┘                 └─────────────────────┘                 └──────────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │  SQLite Database│
                                    │  (file or :mem) │
                                    └─────────────────┘
```

## Prerequisites

- **Node.js** 18 or later (required for native `fetch` support)
- **npm** 9 or later

Verify with:

```bash
node --version   # Must be >= 18.0.0
npm --version
```

---

## 1. Mock HCM Server

The mock HCM server simulates an HR system. It must be running before the backend.

```bash
cd mock-hcm
npm install
npm run start
```

The server starts on **http://localhost:3001**

---

## 2. Backend (NestJS Time-Off Service)

### Environment Setup

```bash
cd time-off-service
```

Edit `.env` if needed (defaults should work for local dev):

```
MOCK_HCM_URL=http://localhost:3001
DATABASE_PATH=./time-off.sqlite
PORT=3000
```

### Install & Run

```bash
cd time-off-service
npm install
npm run start:dev
```

The backend starts on **http://localhost:3000**



---

## 3. Frontend (React + Vite)

### Environment Setup

```bash
cd frontend
```

Check the `.env` file:

```
VITE_API_URL=http://localhost:3000
```

### Install & Run

```bash
cd frontend
npm install
npm run dev
```

The frontend starts on **http://localhost:5173**

---

## 4. Running Tests (On Frontend)

After accessing the frontend 
```bash
1- Go Test Runner page

2- Click on Run Test, it will take some seconds

3- You will see the list of tests that are passed and failed.
```


---

## 5. Running Tests (Backend Only - On Terminal)

All tests run against an in-memory SQLite database and a mock HCM stub — no external services needed.

```bash
cd time-off-service
npm install
```

### Unit Tests

Tests for individual services in isolation:

```bash
npm run test
```

### Coverage Report

Enforces 80% line coverage threshold:

```bash
npm run test:cov
```

Coverage output is saved to `time-off-service/coverage/`.

---

## API Reference

| Method  | Path                                        | Description                                           |
| ------- | ------------------------------------------- | ----------------------------------------------------- |
| `POST`  | `/time-off/request`                         | Submit a new time-off request                         |
| `GET`   | `/time-off/request/:id`                     | Get request by ID                                     |
| `PATCH` | `/time-off/request/:id/cancel`              | Cancel a pending request                              |
| `GET`   | `/time-off/balance/:employeeId/:locationId` | Get all balances for employee at location             |
| `POST`  | `/time-off/sync/realtime`                   | Trigger realtime sync for one employee+location       |
| `POST`  | `/time-off/sync/batch`                      | Ingest full HCM batch payload                         |
| `GET`   | `/time-off/sync/log`                        | Get sync history (filterable by employeeId)           |
| `GET`   | `/dev/run-tests`                            | Run Jest in JSON mode and return test summary/results |

### Mock HCM Endpoints

| Method | Path               | Description                              |
| ------ | ------------------ | ---------------------------------------- |
| `GET`  | `/hcm/balance`     | `?employeeId=&locationId=` — get balance |
| `POST` | `/hcm/time-off`    | Deduct days from balance                 |
| `POST` | `/hcm/batch`       | Upsert multiple balances                 |
| `POST` | `/hcm/anniversary` | Add anniversary bonus days               |

---

## Environment Variables

### time-off-service/.env

| Variable        | Default                 | Description                        |
| --------------- | ----------------------- | ---------------------------------- |
| `MOCK_HCM_URL`  | `http://localhost:3001` | URL of the HCM server              |
| `DATABASE_PATH` | `./time-off.sqlite`     | Path for SQLite database file      |
| `PORT`          | `3000`                  | Port the NestJS service listens on |
| `NODE_ENV`      | `development`           | Environment mode                   |

### frontend/.env

| Variable       | Default                 | Description                    |
| -------------- | ----------------------- | ------------------------------ |
| `VITE_API_URL` | `http://localhost:3000` | Base URL for backend API calls |

---

## Project Structure

```
.
├── TRD.md                    # Technical Requirements Document
├── README_Pics.md            # Contains Proof of output of tests and frontend.
├── Readme.md                 # Final README with Test Runner updates
├── .gitignore
├── time-off-service/         # NestJS backend
│   ├── src/
│   │   ├── balance/          # Balance entity, service, controller, DTOs
│   │   ├── request/          # Request entity, service, controller, DTOs
│   │   ├── sync/             # Sync service, controller, log entity, DTOs
│   │   ├── hcm/              # HCM client (native fetch) and module
│   │   ├── dev/              # Dev-only test runner endpoint
│   │   ├── common/           # Response interceptor, exception filter
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/
│   │   ├── unit/             # Unit tests for services
│   │   └── e2e/              # End-to-end tests
│   ├── .env.example
│   ├── jest.config.js
│   ├── tsconfig.json
│   └── package.json
├── mock-hcm/                 # Standalone mock HCM server
│   ├── src/
│   │   ├── main.ts
│   │   ├── hcm.controller.ts
│   │   └── hcm.store.ts
│   ├── package.json
│   └── tsconfig.json
└── frontend/                 # React + Vite frontend
    ├── src/
    │   ├── api/              # API client and per-resource fetch functions
    │   ├── components/       # Reusable UI components
    │   ├── pages/            # Route-level page components (includes TestRunner)
    │   ├── App.tsx
    │   └── main.tsx
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── tsconfig.json
    └── package.json
```

---

## Development Notes

- The backend uses **optimistic locking** (`version` field) to prevent double-spend on concurrent requests
- HCM is the source of truth — local balances are always overwritten by HCM data on sync
- Requests that land while HCM is down are stored as `PENDING` and resolved on the next sync
- The frontend uses React Query with 30-second polling for live balance updates
- All HTTP communication uses **native fetch only** — no axios anywhere in the codebase

## New Feature: Test Runner

### Backend implementation

- Added `GET /dev/run-tests`
- Implemented in `time-off-service/src/dev/dev.controller.ts`
- Module in `time-off-service/src/dev/dev.module.ts`
- Registered module in `time-off-service/src/app.module.ts`

Endpoint behavior:

1. Spawns Jest using Node `child_process.spawn`
2. Runs Jest with `--json`
3. Captures stdout
4. Parses Jest JSON output
5. Returns normalized summary:

```json
{
  "data": {
    "status": "passed",
    "total": 12,
    "passed": 11,
    "failed": 1,
    "tests": [
      {
        "name": "test description",
        "status": "passed",
        "duration": 120
      }
    ]
  }
}
```

Note: The project-wide response interceptor also includes `error` and `meta` fields in actual API responses.

### Frontend implementation

- Added route: `/test-runner`
- Added nav link in the top navigation
- Added page component in `frontend/src/pages/TestRunner.tsx`
- Added API function in `frontend/src/api/testRunner.api.ts`

UI behavior:

- `Run Tests` button triggers `GET /dev/run-tests`
- While pending: spinner + `Running test suite...`
- On success: summary bar (`X passed, Y failed`) and list of all tests
- Per test: green `✅` for passed, red `❌` for failed, plus duration in ms

---

## How to use/test the new endpoint

### Direct API usage

1. Ensure backend dependencies are installed and backend is running.
2. Send a GET request to:

```http
GET http://localhost:3000/dev/run-tests
```

3. Verify response `data` includes:
   - `status`
   - `total`
   - `passed`
   - `failed`
   - `tests[]` with `name`, `status`, `duration`

### Frontend page usage

1. Open the frontend app.
2. Navigate to `/test-runner` (or click `Test Runner` in nav).
3. Click `Run Tests`.
4. Confirm loading indicator appears with `Running test suite...`.
5. Confirm summary and per-test results render after completion.

---

## Run All Services

cd mock-hcm && npm run start # http://localhost:3001
cd time-off-service && npm run start:dev # http://localhost:3000
cd frontend && npm run dev # http://localhost:5173
