import * as http from 'http';
import { store } from './hcm.store';

const CHAOS_MODE = process.env.CHAOS_MODE === 'true';
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomLatency(): Promise<void> {
  const ms = 50 + Math.random() * 150; // 50–200ms
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendJson(res: http.ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Idempotency-Key',
  });
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function parseQuery(url: string): Record<string, string> {
  const questionIdx = url.indexOf('?');
  if (questionIdx === -1) return {};
  const queryString = url.slice(questionIdx + 1);
  const params: Record<string, string> = {};
  for (const part of queryString.split('&')) {
    const [k, v] = part.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
  }
  return params;
}

// ─── Request Handler ──────────────────────────────────────────────────────────

export function createHandler(): http.RequestListener {
  return async (req, res) => {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';
    const pathname = url.split('?')[0];

    // CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Idempotency-Key',
      });
      return res.end();
    }

    // Apply simulated latency
    await randomLatency();

    // Chaos mode: 20% chance of 503
    if (CHAOS_MODE && Math.random() < 0.2) {
      return sendJson(res, 503, {
        message: 'HCM service temporarily unavailable (chaos mode)',
        code: 'CHAOS_503',
      });
    }

    try {
      // ── GET /hcm/balance ────────────────────────────────────────────────────
      if (method === 'GET' && pathname === '/hcm/balance') {
        const query = parseQuery(url);
        const { employeeId, locationId } = query;

        if (!employeeId || !locationId) {
          return sendJson(res, 400, {
            message: 'employeeId and locationId query params are required',
          });
        }

        const balances = store.getBalances(employeeId, locationId);

        if (balances.length === 0) {
          return sendJson(res, 404, {
            message: `No balances found for employee=${employeeId}, location=${locationId}`,
          });
        }

        return sendJson(res, 200, balances);
      }

      // ── POST /hcm/time-off ──────────────────────────────────────────────────
      if (method === 'POST' && pathname === '/hcm/time-off') {
        const body = (await readBody(req)) as any;
        const { employeeId, locationId, leaveType, days } = body;

        if (!employeeId || !locationId || !leaveType || days === undefined || days === null) {
          return sendJson(res, 400, {
            message: 'employeeId, locationId, leaveType, and days are required',
          });
        }

        if (typeof days !== 'number' || days <= 0) {
          return sendJson(res, 400, { message: 'days must be a positive number' });
        }

        const result = store.deductBalance(employeeId, locationId, leaveType, days);

        if (!result.success) {
          return sendJson(res, 422, {
            message: result.error ?? 'Unable to process time-off request',
            code: 'INSUFFICIENT_BALANCE',
          });
        }

        return sendJson(res, 200, {
          ref: result.ref,
          status: 'APPROVED',
          newBalance: result.newBalance,
        });
      }

      // ── POST /hcm/time-off/cancel ───────────────────────────────────────────
      if (method === 'POST' && pathname === '/hcm/time-off/cancel') {
        const body = (await readBody(req)) as any;
        const { employeeId, locationId, leaveType, days } = body;

        if (employeeId && locationId && leaveType && days) {
          store.restoreBalance(employeeId, locationId, leaveType, days);
        }

        return sendJson(res, 200, { message: 'Cancellation acknowledged' });
      }

      // ── POST /hcm/batch ─────────────────────────────────────────────────────
      if (method === 'POST' && pathname === '/hcm/batch') {
        const body = (await readBody(req)) as any;
        const records = body?.records;

        if (!Array.isArray(records)) {
          return sendJson(res, 400, { message: 'records must be an array' });
        }

        let upserted = 0;
        const errors: string[] = [];

        for (const record of records) {
          const { employeeId, locationId, leaveType, balance } = record;
          if (!employeeId || !locationId || !leaveType || balance === undefined) {
            errors.push(`Invalid record: ${JSON.stringify(record)}`);
            continue;
          }
          store.upsertBalance(employeeId, locationId, leaveType, balance);
          upserted++;
        }

        return sendJson(res, 200, { upserted, errors });
      }

      // ── POST /hcm/anniversary ───────────────────────────────────────────────
      if (method === 'POST' && pathname === '/hcm/anniversary') {
        const body = (await readBody(req)) as any;
        const { employeeId, locationId, bonus } = body;

        if (!employeeId || !locationId || bonus === undefined) {
          return sendJson(res, 400, {
            message: 'employeeId, locationId, and bonus are required',
          });
        }

        store.addAniversaryBonus(employeeId, locationId, bonus);

        return sendJson(res, 200, {
          message: `Anniversary bonus of ${bonus} days added for ${employeeId} at ${locationId}`,
        });
      }

      // ── GET /hcm/admin/balances ─────────────────────────────────────────────
      if (method === 'GET' && pathname === '/hcm/admin/balances') {
        return sendJson(res, 200, store.getAllBalances());
      }

      // ── 404 ─────────────────────────────────────────────────────────────────
      return sendJson(res, 404, { message: `Route ${method} ${pathname} not found` });
    } catch (err: any) {
      console.error('[MockHCM] Error:', err);
      return sendJson(res, 500, { message: err.message ?? 'Internal error' });
    }
  };
}
