# Technical Requirements Document (TRD)
## Time-Off Microservice

**Version:** 1.0.0  
**Date:** 2026-04-25  
**Author:** Syed Areeb Ashraf 

---

## 1.1 Problem Statement

### Dual-System Sync Challenge

The organization maintains two authoritative systems:
- **HCM (Human Capital Management)** — the source of truth for employee leave balances
- **Time-Off Microservice** — a local cache + request orchestrator that must stay synchronized

### Root Causes of Balance Drift

| Event | Description | Impact |
|-------|-------------|--------|
| **Anniversary Bonuses** | HCM automatically credits extra days when an employee reaches a tenure milestone | Local balance becomes stale until next sync |
| **Year-Start Resets** | On Jan 1 (or fiscal year start), HCM resets all accrual balances | Without batch sync, local service sees incorrect carryover |
| **Manual HCM Edits** | HR admins can directly adjust balances in HCM (e.g., corrections, unpaid leave deductions) | Local balance silently diverges with no event notification |
| **Race Conditions** | Two concurrent requests submitted near-simultaneously can both pass local balance checks, causing double-spend against HCM | One request must be rolled back; local balance must be restored |

### Consequence of Drift

If the local service acts as the sole decision-maker without reconciling against HCM, employees can:
- Request more leave than they actually have (over-approval)
- Be denied leave they legitimately earned (under-approval)
- Experience UI showing incorrect balances, eroding trust

### Solution Summary

This microservice treats HCM as canonical truth and implements a layered sync strategy: optimistic local decisions for latency, with guaranteed HCM confirmation and automatic rollback on divergence.

---

## 1.2 Data Model

### TimeOffBalance

Represents the locally-cached copy of an employee's leave balance for a given location and leave type.

```typescript
interface TimeOffBalance {
  id: number;                    // Auto-increment primary key
  employeeId: string;            // Unique employee identifier (from HCM)
  locationId: string;            // Work location / business unit identifier
  leaveType: string;             // e.g., "ANNUAL", "SICK", "PERSONAL", "MATERNITY"
  balance: number;               // Current available days (decimal allowed, e.g., 0.5)
  lastSyncedAt: Date;            // Timestamp of last successful HCM sync
  version: number;               // Optimistic locking counter (incremented on every write)
}
```

**Unique constraint:** `(employeeId, locationId, leaveType)` — exactly one balance record per employee per location per leave type.

**Indexes:**
- `(employeeId, locationId)` — for efficient balance lookups by employee
- `lastSyncedAt` — for detecting stale records in batch sync jobs

### TimeOffRequest

Represents a submitted leave request and its lifecycle state.

```typescript
interface TimeOffRequest {
  id: number;                    // Auto-increment primary key
  employeeId: string;            // Employee who submitted the request
  locationId: string;            // Their work location at time of submission
  leaveType: string;             // Type of leave requested
  days: number;                  // Number of days requested (must be > 0)
  status: RequestStatus;         // Current state machine position
  hcmRef: string | null;         // Reference ID returned by HCM on approval (for idempotency)
  createdAt: Date;               // When the request was submitted
  updatedAt: Date;               // Last status transition timestamp
}

enum RequestStatus {
  PENDING    = 'PENDING',        // Submitted to HCM; awaiting confirmation
  APPROVED   = 'APPROVED',       // HCM confirmed deduction
  REJECTED   = 'REJECTED',       // HCM rejected (e.g., insufficient balance in HCM)
  CANCELLED  = 'CANCELLED',      // Employee cancelled before APPROVED
}
```

**Valid status transitions:**

```
PENDING → APPROVED    (HCM confirms deduction)
PENDING → REJECTED    (HCM rejects or returns error)
PENDING → CANCELLED   (Employee cancels before HCM responds)
APPROVED → (terminal) (No further transitions allowed)
REJECTED → (terminal)
CANCELLED → (terminal)
```

### SyncLog

Audit trail of every synchronization event between the local service and HCM.

```typescript
interface SyncLog {
  id: number;                      // Auto-increment primary key
  employeeId: string;              // Employee whose balance was synced
  locationId: string;              // Their location
  leaveType: string;               // Leave type that was synced
  trigger: SyncTrigger;            // What caused this sync
  delta: number;                   // Balance change: (new - old), signed
  previousBalance: number;         // Balance before sync
  newBalance: number;              // Balance after sync
  timestamp: Date;                 // When the sync occurred
}

enum SyncTrigger {
  BATCH     = 'BATCH',             // Periodic batch ingestion job
  REALTIME  = 'REALTIME',          // Per-request HCM lookup
  MANUAL    = 'MANUAL',            // Admin-triggered sync via API
}
```

---

## 1.3 API Endpoints

### Base URL
`http://localhost:3000`

### Response Envelope

All responses follow this structure:

```json
{
  "data": { ... } | null,
  "error": { "message": "...", "code": "...", "details": [...] } | null,
  "meta": { "timestamp": "ISO8601", "requestId": "uuid" }
}
```

---

### POST /time-off/request
Submit a new time-off request.

**Request Body:**
```json
{
  "employeeId": "EMP001",
  "locationId": "LOC_NYC",
  "leaveType": "ANNUAL",
  "days": 3
}
```

**Validation:**
- `employeeId`: required, non-empty string
- `locationId`: required, non-empty string
- `leaveType`: required, one of `["ANNUAL", "SICK", "PERSONAL", "MATERNITY"]`
- `days`: required, positive number, min 0.5

**Success Response (201):**
```json
{
  "data": {
    "id": 42,
    "employeeId": "EMP001",
    "locationId": "LOC_NYC",
    "leaveType": "ANNUAL",
    "days": 3,
    "status": "APPROVED",
    "hcmRef": "HCM-REF-7891",
    "createdAt": "2026-04-25T03:08:00.000Z",
    "updatedAt": "2026-04-25T03:08:00.500Z"
  },
  "error": null,
  "meta": { "timestamp": "2026-04-25T03:08:00.600Z", "requestId": "a1b2c3" }
}
```

**Error Responses:**
- `400 Bad Request` — Validation failure with field-level errors
- `422 Unprocessable Entity` — Insufficient balance or unknown employee/location
- `503 Service Unavailable` — HCM unreachable; request remains PENDING

---

### GET /time-off/request/:id
Retrieve a request by ID.

**Success Response (200):** Same shape as POST response `data` field.

**Error Responses:**
- `404 Not Found` — Request does not exist

---

### PATCH /time-off/request/:id/cancel
Cancel a PENDING request.

**Success Response (200):**
```json
{
  "data": { "id": 42, "status": "CANCELLED", ... },
  "error": null,
  "meta": { ... }
}
```

**Error Responses:**
- `404 Not Found` — Request does not exist
- `409 Conflict` — Request is not in PENDING state

---

### GET /time-off/balance/:employeeId/:locationId
Get all leave balances for an employee at a location.

**Success Response (200):**
```json
{
  "data": [
    {
      "id": 1,
      "employeeId": "EMP001",
      "locationId": "LOC_NYC",
      "leaveType": "ANNUAL",
      "balance": 12.5,
      "lastSyncedAt": "2026-04-24T00:00:00.000Z",
      "version": 5
    }
  ],
  "error": null,
  "meta": { ... }
}
```

---

### POST /time-off/sync/realtime
Trigger a realtime sync for one employee+location from HCM.

**Request Body:**
```json
{
  "employeeId": "EMP001",
  "locationId": "LOC_NYC"
}
```

**Success Response (200):**
```json
{
  "data": {
    "synced": 2,
    "logs": [ { "leaveType": "ANNUAL", "delta": 1.5, ... } ]
  },
  "error": null,
  "meta": { ... }
}
```

---

### POST /time-off/sync/batch
Ingest a full HCM batch payload updating multiple employees.

**Request Body:**
```json
{
  "records": [
    { "employeeId": "EMP001", "locationId": "LOC_NYC", "leaveType": "ANNUAL", "balance": 15.0 },
    { "employeeId": "EMP002", "locationId": "LOC_LA",  "leaveType": "SICK",   "balance": 5.0 }
  ]
}
```

**Success Response (200):**
```json
{
  "data": {
    "processed": 2,
    "failed": 0,
    "logs": [ ... ]
  },
  "error": null,
  "meta": { ... }
}
```

**Partial Failure:** If individual records fail validation, they are skipped and reported in `failed` count. Valid records are still processed.

---

### GET /time-off/sync/log
Get sync history, filterable by employeeId.

**Query Parameters:**
- `employeeId` (optional): Filter logs by employee
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20): Records per page

**Success Response (200):**
```json
{
  "data": {
    "items": [ { "id": 1, "employeeId": "EMP001", "delta": 1.5, ... } ],
    "total": 42,
    "page": 1,
    "limit": 20
  },
  "error": null,
  "meta": { ... }
}
```

---

## 1.4 HCM Integration Design

### Client Architecture (`hcm.client.ts`)

The HCM client is a thin wrapper around Node.js native `fetch` with:
1. **Retry logic** — exponential backoff on 5xx errors
2. **Timeout** — AbortController with 10-second timeout per attempt
3. **Idempotency** — idempotency key sent as `X-Idempotency-Key` header

### Retry Logic

```
Max attempts: 3
Backoff: attempt 1 → 500ms, attempt 2 → 1000ms, attempt 3 → 2000ms
Retryable statuses: 503, 504, network errors (ECONNREFUSED, ETIMEDOUT)
Non-retryable statuses: 400, 422, 404 (client errors — don't retry)
```

### Idempotency

Every `POST /hcm/time-off` call includes an `X-Idempotency-Key` header derived from:
```
sha256(employeeId + locationId + leaveType + days + requestId)
```

This ensures that if a retry occurs after HCM processed the original request but before our service received the response, HCM will return the same result without double-deducting.

### Partial Batch Failure Handling

When `POST /time-off/sync/batch` is called:
1. Each record is validated independently before any DB writes
2. Invalid records are collected in a `failed` list with specific error reasons
3. Valid records are upserted atomically per record (not a single all-or-nothing transaction) to prevent one bad row from blocking all valid updates
4. The response always includes both `processed` and `failed` counts
5. A SyncLog entry is created for each successfully processed record

---

## 1.5 Sync Strategy

### Sync Triggers

| Trigger | When | Mechanism |
|---------|------|-----------|
| **REALTIME** | On every `POST /time-off/request` submission | Fetch latest balance from HCM before deducting locally |
| **REALTIME** | Admin calls `POST /time-off/sync/realtime` | Immediate HCM pull for one employee+location |
| **BATCH** | Admin calls `POST /time-off/sync/batch` | Bulk ingest of HCM snapshot (e.g., nightly export) |
| **MANUAL** | Admin triggers via Sync Admin UI | Equivalent to REALTIME trigger, logged as MANUAL |

### Defensive Fallback Strategy

1. **HCM unreachable during request submission:**
   - Mark request as `PENDING` (not rejected)
   - Store the intended deduction amount
   - Do NOT deduct locally (balance unchanged until HCM confirms)
   - On next sync (batch or realtime), resolve PENDING requests against fresh HCM data

2. **Stale balance detected (local `lastSyncedAt` > 1 hour old):**
   - Automatically trigger a REALTIME sync before evaluating a new request
   - Log a warning with the staleness duration

3. **HCM returns a different balance than expected:**
   - Overwrite local balance with HCM value (HCM always wins)
   - Log the delta as a SyncLog entry
   - Emit a warning if delta exceeds ±5 days (potential manual edit in HCM)

4. **Version conflict on write:**
   - Retry the read-modify-write cycle up to 3 times
   - If all retries fail, return 409 Conflict to the caller

---

## 1.6 Concurrency & Integrity

### Optimistic Locking via `version` Field

Every `TimeOffBalance` record has a monotonically-incrementing `version` field.

**Read-Modify-Write Pattern:**
```sql
-- Read
SELECT * FROM time_off_balance WHERE employeeId = ? AND locationId = ? AND leaveType = ?;
-- version = 5, balance = 10

-- Compute new balance
new_balance = 10 - requested_days

-- Write with version check
UPDATE time_off_balance
SET balance = ?, version = version + 1, updatedAt = NOW()
WHERE id = ? AND version = 5;  -- fails if another process already incremented version

-- If affected rows = 0 → conflict → retry or reject
```

**Why Optimistic (not Pessimistic) Locking?**
- Lock contention on a single employee's balance row is rare in normal operations
- Pessimistic locks (`SELECT FOR UPDATE`) block other read queries and reduce throughput
- Optimistic locking is more scalable for read-heavy workloads

### Double-Spend Prevention

The following sequence prevents double-spend on concurrent requests:

1. Request A and Request B both read `balance = 10`, both intend to deduct 7 days
2. Request A writes first: `UPDATE ... SET balance = 3, version = 6 WHERE version = 5` → succeeds
3. Request B writes: `UPDATE ... SET balance = 3, version = 6 WHERE version = 5` → **0 rows affected**
4. Request B detects conflict → re-reads balance (now 3) → 3 < 7 → rejects with `INSUFFICIENT_BALANCE`
5. Request A is submitted to HCM → APPROVED
6. Request B returns 422 to the caller

### Database Constraints

```sql
UNIQUE (employeeId, locationId, leaveType)   -- prevents duplicate balance records
CHECK (balance >= 0)                          -- no negative balances stored
CHECK (days > 0)                              -- no zero/negative requests
```

---

## 1.7 Frontend Architecture

### Component Tree

```
App (React Router)
├── Layout
│   ├── Navbar
│   └── <Outlet />
├── Dashboard (/)
│   ├── BalanceCard[]          ← one per (locationId, leaveType) combination
│   └── SyncStatusBadge        ← shows lastSyncedAt + staleness indicator
├── RequestPage (/request)
│   ├── RequestForm
│   │   ├── EmployeeIdInput
│   │   ├── LocationSelect
│   │   ├── LeaveTypeSelect
│   │   ├── DaysInput
│   │   ├── BalancePreview     ← live remaining = balance - days (updated as user types)
│   │   └── SubmitButton       ← disabled when days > balance or form invalid
│   └── ErrorBanner            ← shown on submission failure
├── MyRequests (/requests)
│   ├── RequestRow[]
│   │   ├── StatusBadge
│   │   └── CancelButton       ← only shown for PENDING
│   └── EmptyState
└── SyncAdmin (/sync)
    ├── RealtimeSyncForm       ← employeeId + locationId inputs
    ├── BatchSyncForm          ← textarea for JSON payload
    └── SyncLogTable
        ├── SyncLogRow[]
        └── Pagination
```

### Data Flow

```
React Query Cache
     │
     ├─ useBalances(employeeId, locationId)  → GET /time-off/balance/:eid/:lid
     ├─ useRequests(employeeId)              → GET /time-off/request (with filter)
     └─ useSyncLog(filters)                 → GET /time-off/sync/log

User Actions → Mutations
     ├─ submitRequest()   → POST /time-off/request  → optimistic balance update
     ├─ cancelRequest()   → PATCH /time-off/request/:id/cancel
     ├─ triggerSync()     → POST /time-off/sync/realtime
     └─ ingestBatch()     → POST /time-off/sync/batch
```

### How UI Reflects Sync State

| Condition | UI Behavior |
|-----------|-------------|
| `lastSyncedAt` < 5 min ago | Green "Synced" badge |
| `lastSyncedAt` 5–60 min ago | Yellow "Stale" badge |
| `lastSyncedAt` > 1 hour ago | Red "Out of Sync" badge |
| Balance changed since last view (React Query refetch) | Brief highlight animation on BalanceCard |
| PENDING request resolving to APPROVED | Status chip animates from yellow → green |

### Auto-Refresh

React Query is configured with:
```typescript
staleTime: 30_000,     // data considered fresh for 30 seconds
refetchInterval: 30_000  // poll every 30 seconds for balances
```

---

## 1.8 Challenges & Alternatives Considered

### Decision 1: Optimistic vs. Pessimistic Locking

**Problem:** Concurrent requests against the same employee balance could double-spend.

**Alternative A — Database-level row locks (`SELECT FOR UPDATE`):**
- Pro: Guaranteed serialization at the DB level
- Con: In SQLite (chosen for simplicity), WAL mode still serializes writes; row locks add overhead without benefit. For PostgreSQL this would be viable.

**Alternative B — Application-level mutex (in-memory):**
- Pro: Simple to implement in a single-process service
- Con: Breaks in a multi-instance deployment; not production-grade

**Chosen — Optimistic locking via `version` field:**
- Works correctly across multiple instances if they share the same DB
- No write blocking for readers
- Conflict rate is low in typical usage, making retries cheap
- Scales to PostgreSQL migration without architectural change

---

### Decision 2: SQLite vs. PostgreSQL

**Problem:** Choose a database that supports development simplicity without painting the team into a corner.

**Alternative A — PostgreSQL:**
- Pro: Full ACID, advisory locks, LISTEN/NOTIFY for event-driven sync
- Con: Requires Docker or a hosted instance; complex local dev setup; not necessary for the scale of this assessment

**Alternative B — In-memory store (plain JS Map):**
- Pro: Zero setup
- Con: No persistence; can't test realistic concurrent writes; no query capabilities

**Chosen — SQLite via TypeORM:**
- Zero external dependencies for local development
- TypeORM abstracts the dialect, so migrating to PostgreSQL is a config change
- `:memory:` mode in tests enables fast, isolated, parallel test runs
- Adequate for the expected load; can be swapped via `DATABASE_URL` env var

---

### Decision 3: Async HCM Confirmation vs. Synchronous Block

**Problem:** HCM has latency (50–200ms). Should the API block until HCM responds?

**Alternative A — Fire-and-forget (async queue):**
- Pro: API responds instantly; resilient to HCM downtime
- Con: Complex: requires a message broker (Redis, RabbitMQ), a consumer process, and a reconciliation loop

**Alternative B — Synchronous block with timeout:**
- Pro: Simpler; immediate confirmation to user
- Con: If HCM is slow, API p99 latency spikes

**Chosen — Synchronous with retry + PENDING fallback:**
- Block for up to 10 seconds (3 retries with backoff)
- If HCM is still unresponsive, return status `PENDING` to user (not an error)
- Next sync cycle resolves PENDING requests
- This avoids queue infrastructure while providing a better UX than pure async "we'll let you know"

---

### Decision 4: Native Fetch vs. Axios

**Problem:** Node.js 18+ includes native `fetch`. Using axios adds a dependency without significant benefit.

**Chosen — Native fetch with custom wrapper (`hcm.client.ts`):**
- Zero dependency footprint
- `AbortController` provides timeout control
- Custom retry logic is explicit and testable
- `Headers` API is standard and portable to the frontend

---

*End of TRD*
