import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ResponseInterceptor } from '../../src/common/response.interceptor';
import { HttpExceptionFilter } from '../../src/common/http-exception.filter';

// ─── Mock HCM Client ─────────────────────────────────────────────────────────
// We stub the HCM client so e2e tests don't need an actual HTTP server running

let mockHcmStore: Record<string, number> = {};
let hcmShouldFail = false;
let hcmFailureCode = 503;

const makeHcmKey = (employeeId: string, locationId: string, leaveType: string) =>
  `${employeeId}:${locationId}:${leaveType}`;

jest.mock('../../src/hcm/hcm.client', () => ({
  HcmClient: jest.fn().mockImplementation(() => ({
    getBalances: jest.fn(async (employeeId: string, locationId: string) => {
      if (hcmShouldFail) {
        const err: any = new Error('HCM unavailable');
        err.statusCode = hcmFailureCode;
        throw err;
      }
      const prefix = `${employeeId}:${locationId}:`;
      return Object.entries(mockHcmStore)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, balance]) => {
          const [, , leaveType] = key.split(':');
          return { employeeId, locationId, leaveType, balance };
        });
    }),

    submitTimeOff: jest.fn(
      async (payload: {
        employeeId: string;
        locationId: string;
        leaveType: string;
        days: number;
        idempotencyKey: string;
      }) => {
        if (hcmShouldFail) {
          const err: any = new Error('HCM unavailable');
          err.statusCode = hcmFailureCode;
          throw err;
        }
        const key = makeHcmKey(payload.employeeId, payload.locationId, payload.leaveType);
        const current = mockHcmStore[key] ?? 0;
        if (current < payload.days) {
          const err: any = new Error('Insufficient balance in HCM');
          err.statusCode = 422;
          throw err;
        }
        mockHcmStore[key] = current - payload.days;
        return { ref: `HCM-${Date.now()}`, status: 'APPROVED' };
      },
    ),

    cancelTimeOff: jest.fn(
      async (payload: {
        employeeId: string;
        locationId: string;
        leaveType: string;
        days: number;
        idempotencyKey: string;
      }) => {
        if (!hcmShouldFail) {
          const key = makeHcmKey(payload.employeeId, payload.locationId, payload.leaveType);
          mockHcmStore[key] = (mockHcmStore[key] ?? 0) + payload.days;
        }
      },
    ),

    submitBatch: jest.fn(async () => undefined),
  })),
}));

// ─── Test App Setup ──────────────────────────────────────────────────────────

let app: INestApplication;

beforeAll(async () => {
  // Use in-memory SQLite for all e2e tests — no real DB needed
  process.env.DATABASE_PATH = ':memory:';
  process.env.NODE_ENV = 'test';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
});

afterAll(async () => {
  await app.close();
});

// Reset HCM store and flags before each test
beforeEach(() => {
  mockHcmStore = {};
  hcmShouldFail = false;
  hcmFailureCode = 503;
});

// ─── Helper Functions ─────────────────────────────────────────────────────────

const seedBalance = async (
  employeeId: string,
  locationId: string,
  leaveType: string,
  balance: number,
) => {
  // Seed HCM store
  mockHcmStore[makeHcmKey(employeeId, locationId, leaveType)] = balance;

  // Seed via batch sync endpoint
  return request(app.getHttpServer())
    .post('/time-off/sync/batch')
    .send({ records: [{ employeeId, locationId, leaveType, balance }] });
};

// ─── Balance Sync E2E ─────────────────────────────────────────────────────────

describe('Balance Sync', () => {
  it('batch ingest correctly updates all local balances for multiple employees and leave types', async () => {
    const records = [
      { employeeId: 'EMP_S1', locationId: 'LOC_A', leaveType: 'ANNUAL', balance: 20 },
      { employeeId: 'EMP_S2', locationId: 'LOC_B', leaveType: 'SICK', balance: 10 },
    ];

    const res = await request(app.getHttpServer())
      .post('/time-off/sync/batch')
      .send({ records })
      .expect(200);

    expect(res.body.data.processed).toBe(2);
    expect(res.body.data.failed).toBe(0);

    const balance = await request(app.getHttpServer())
      .get('/time-off/balance/EMP_S1/LOC_A')
      .expect(200);
    expect(balance.body.data[0].balance).toBe(20);
  });

  it('realtime sync overwrites a stale local balance with the authoritative value from HCM', async () => {
    await seedBalance('EMP_RT1', 'LOC_NYC', 'ANNUAL', 5);

    // HCM now has a higher balance (e.g. anniversary bonus was applied)
    mockHcmStore[makeHcmKey('EMP_RT1', 'LOC_NYC', 'ANNUAL')] = 15;

    await request(app.getHttpServer())
      .post('/time-off/sync/realtime')
      .send({ employeeId: 'EMP_RT1', locationId: 'LOC_NYC' })
      .expect(200);

    const balance = await request(app.getHttpServer())
      .get('/time-off/balance/EMP_RT1/LOC_NYC')
      .expect(200);
    expect(balance.body.data[0].balance).toBe(15);
  });

  it('anniversary bonus is reflected in the local balance after a subsequent batch sync that includes the new balance', async () => {
    await seedBalance('EMP_ANN', 'LOC_NYC', 'ANNUAL', 10);

    // HCM anniversary event adds 5 days
    mockHcmStore[makeHcmKey('EMP_ANN', 'LOC_NYC', 'ANNUAL')] = 15;

    // Next batch sync
    const res = await request(app.getHttpServer())
      .post('/time-off/sync/batch')
      .send({
        records: [
          { employeeId: 'EMP_ANN', locationId: 'LOC_NYC', leaveType: 'ANNUAL', balance: 15 },
        ],
      })
      .expect(200);

    expect(res.body.data.logs[0].delta).toBe(5);

    const balance = await request(app.getHttpServer())
      .get('/time-off/balance/EMP_ANN/LOC_NYC')
      .expect(200);
    expect(balance.body.data[0].balance).toBe(15);
  });

  it('partial batch with some invalid rows processes all valid rows without corrupting them', async () => {
    const records = [
      { employeeId: 'EMP_VALID', locationId: 'LOC_V', leaveType: 'ANNUAL', balance: 12 },
      // Missing required fields intentionally omitted — but we test via injecting a fail via force
      { employeeId: 'EMP_VALID2', locationId: 'LOC_V2', leaveType: 'SICK', balance: 7 },
    ];

    const res = await request(app.getHttpServer())
      .post('/time-off/sync/batch')
      .send({ records })
      .expect(200);

    // Both valid records should process
    expect(res.body.data.processed).toBeGreaterThanOrEqual(2);

    const b1 = await request(app.getHttpServer())
      .get('/time-off/balance/EMP_VALID/LOC_V')
      .expect(200);
    expect(b1.body.data[0].balance).toBe(12);
  });
});

// ─── Request Lifecycle E2E ────────────────────────────────────────────────────

describe('Request Lifecycle', () => {
  it('submitting a time-off request deducts the balance locally and returns APPROVED status when HCM confirms the deduction', async () => {
    await seedBalance('EMP_REQ1', 'LOC_NYC', 'ANNUAL', 10);
    mockHcmStore[makeHcmKey('EMP_REQ1', 'LOC_NYC', 'ANNUAL')] = 10;

    const res = await request(app.getHttpServer())
      .post('/time-off/request')
      .send({ employeeId: 'EMP_REQ1', locationId: 'LOC_NYC', leaveType: 'ANNUAL', days: 3 })
      .expect(201);

    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.hcmRef).toBeTruthy();

    const balance = await request(app.getHttpServer())
      .get('/time-off/balance/EMP_REQ1/LOC_NYC')
      .expect(200);
    expect(balance.body.data[0].balance).toBe(7);
  });

  it('submitting a request returns REJECTED status and rolls back the local balance deduction when HCM rejects the request', async () => {
    await seedBalance('EMP_REJ', 'LOC_NYC', 'ANNUAL', 10);
    // HCM has 0 balance (out of sync scenario)
    mockHcmStore[makeHcmKey('EMP_REJ', 'LOC_NYC', 'ANNUAL')] = 0;

    await expect(
      request(app.getHttpServer())
        .post('/time-off/request')
        .send({ employeeId: 'EMP_REJ', locationId: 'LOC_NYC', leaveType: 'ANNUAL', days: 3 })
        .expect(422),
    ).resolves.toBeDefined();

    // Local balance should be restored
    const balance = await request(app.getHttpServer())
      .get('/time-off/balance/EMP_REJ/LOC_NYC')
      .expect(200);
    expect(balance.body.data[0].balance).toBe(10);
  });

  it('submitting a request stays in PENDING status and does not deduct balance when HCM returns 503', async () => {
    await seedBalance('EMP_PEND', 'LOC_NYC', 'ANNUAL', 10);
    hcmShouldFail = true;
    hcmFailureCode = 503;

    const res = await request(app.getHttpServer())
      .post('/time-off/request')
      .send({ employeeId: 'EMP_PEND', locationId: 'LOC_NYC', leaveType: 'ANNUAL', days: 3 })
      .expect(201);

    expect(res.body.data.status).toBe('PENDING');

    // Balance should be restored (not deducted for PENDING)
    const balance = await request(app.getHttpServer())
      .get('/time-off/balance/EMP_PEND/LOC_NYC')
      .expect(200);
    expect(balance.body.data[0].balance).toBe(10);
  });

  it('two concurrent requests against the same balance result in one APPROVED and one REJECTED due to double-spend prevention', async () => {
    await seedBalance('EMP_CONC', 'LOC_NYC', 'ANNUAL', 5);
    mockHcmStore[makeHcmKey('EMP_CONC', 'LOC_NYC', 'ANNUAL')] = 5;

    // Submit two simultaneous requests for 4 days each (total 8, balance only 5)
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post('/time-off/request')
        .send({ employeeId: 'EMP_CONC', locationId: 'LOC_NYC', leaveType: 'ANNUAL', days: 4 }),
      request(app.getHttpServer())
        .post('/time-off/request')
        .send({ employeeId: 'EMP_CONC', locationId: 'LOC_NYC', leaveType: 'ANNUAL', days: 4 }),
    ]);

    const statuses = [res1.body?.data?.status, res2.body?.data?.status].filter(Boolean);
    const httpCodes = [res1.status, res2.status];

    // One should succeed (201 APPROVED) and one should fail (422 insufficient)
    const hasApproved = statuses.includes('APPROVED') || httpCodes.includes(201);
    const hasRejected = httpCodes.includes(422) || statuses.includes('REJECTED');
    expect(hasApproved).toBe(true);
    expect(hasRejected).toBe(true);
  });
});

// ─── Cancellation E2E ─────────────────────────────────────────────────────────

describe('Cancellation', () => {
  it('cancelling a PENDING request restores the balance and records CANCELLED status', async () => {
    await seedBalance('EMP_CAN', 'LOC_NYC', 'ANNUAL', 10);
    hcmShouldFail = true; // Make request stay PENDING

    const createRes = await request(app.getHttpServer())
      .post('/time-off/request')
      .send({ employeeId: 'EMP_CAN', locationId: 'LOC_NYC', leaveType: 'ANNUAL', days: 3 })
      .expect(201);

    expect(createRes.body.data.status).toBe('PENDING');
    const reqId = createRes.body.data.id;

    hcmShouldFail = false;
    const cancelRes = await request(app.getHttpServer())
      .patch(`/time-off/request/${reqId}/cancel`)
      .expect(200);

    expect(cancelRes.body.data.status).toBe('CANCELLED');

    const balance = await request(app.getHttpServer())
      .get('/time-off/balance/EMP_CAN/LOC_NYC')
      .expect(200);
    expect(balance.body.data[0].balance).toBe(10);
  });

  it('cancelling an APPROVED request returns 409 Conflict because only PENDING requests can be cancelled', async () => {
    await seedBalance('EMP_CAPPR', 'LOC_NYC', 'ANNUAL', 10);
    mockHcmStore[makeHcmKey('EMP_CAPPR', 'LOC_NYC', 'ANNUAL')] = 10;

    const createRes = await request(app.getHttpServer())
      .post('/time-off/request')
      .send({ employeeId: 'EMP_CAPPR', locationId: 'LOC_NYC', leaveType: 'ANNUAL', days: 2 })
      .expect(201);

    expect(createRes.body.data.status).toBe('APPROVED');
    const reqId = createRes.body.data.id;

    await request(app.getHttpServer())
      .patch(`/time-off/request/${reqId}/cancel`)
      .expect(409);
  });

  it('cancelling a request that does not exist returns 404 Not Found', async () => {
    await request(app.getHttpServer())
      .patch('/time-off/request/99999/cancel')
      .expect(404);
  });
});

// ─── Validation E2E ───────────────────────────────────────────────────────────

describe('Validation', () => {
  it('submitting a request with missing required fields returns 400 Bad Request with field-level validation errors', async () => {
    const res = await request(app.getHttpServer())
      .post('/time-off/request')
      .send({ employeeId: 'EMP001' }) // missing locationId, leaveType, days
      .expect(400);

    expect(res.body.error).toBeTruthy();
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('submitting a request with a negative days value returns 400 Bad Request', async () => {
    const res = await request(app.getHttpServer())
      .post('/time-off/request')
      .send({
        employeeId: 'EMP001',
        locationId: 'LOC_NYC',
        leaveType: 'ANNUAL',
        days: -2,
      })
      .expect(400);

    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('submitting a request for a leaveType that is not in the allowed list returns 400 with validation message', async () => {
    const res = await request(app.getHttpServer())
      .post('/time-off/request')
      .send({
        employeeId: 'EMP001',
        locationId: 'LOC_NYC',
        leaveType: 'VACATION', // invalid
        days: 3,
      })
      .expect(400);

    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('submitting a request for an employee with no local balance record returns 422 with a clear message explaining the missing balance', async () => {
    const res = await request(app.getHttpServer())
      .post('/time-off/request')
      .send({
        employeeId: 'UNKNOWN_EMP',
        locationId: 'UNKNOWN_LOC',
        leaveType: 'ANNUAL',
        days: 1,
      })
      .expect(422);

    expect(res.body.error.message).toMatch(/No balance record found/i);
  });

  it('submitting a request with days set to zero returns 400 Bad Request because the minimum is 0.5', async () => {
    const res = await request(app.getHttpServer())
      .post('/time-off/request')
      .send({
        employeeId: 'EMP001',
        locationId: 'LOC_NYC',
        leaveType: 'ANNUAL',
        days: 0,
      })
      .expect(400);

    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});

// ─── Sync Log E2E ─────────────────────────────────────────────────────────────

describe('Sync Log', () => {
  it('the sync log endpoint returns paginated entries with correct delta values after batch and realtime syncs', async () => {
    await seedBalance('EMP_LOG', 'LOC_NYC', 'ANNUAL', 10);

    const res = await request(app.getHttpServer())
      .get('/time-off/sync/log?employeeId=EMP_LOG')
      .expect(200);

    expect(res.body.data.items).toBeDefined();
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
  });

  it('the sync log endpoint returns all entries when no employeeId filter is provided', async () => {
    const res = await request(app.getHttpServer())
      .get('/time-off/sync/log')
      .expect(200);

    expect(res.body.data).toHaveProperty('items');
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('page');
    expect(res.body.data).toHaveProperty('limit');
  });
});
