import { Injectable } from '@nestjs/common';

export interface HcmBalance {
  employeeId: string;
  locationId: string;
  leaveType: string;
  balance: number;
}

export interface HcmTimeOffPayload {
  employeeId: string;
  locationId: string;
  leaveType: string;
  days: number;
  idempotencyKey: string;
}

export interface HcmTimeOffResult {
  ref: string;
  status: 'APPROVED' | 'REJECTED';
  message?: string;
}

export class HcmError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'HcmError';
  }
}

@Injectable()
export class HcmClient {
  private readonly baseUrl: string;
  private readonly maxRetries = 3;
  private readonly timeoutMs = 10_000;

  constructor() {
    this.baseUrl = process.env.MOCK_HCM_URL ?? 'http://localhost:3001';
  }

  /**
   * Fetch all balances for an employee at a location from HCM.
   */
  async getBalances(
    employeeId: string,
    locationId: string,
  ): Promise<HcmBalance[]> {
    const url = `${this.baseUrl}/hcm/balance?employeeId=${encodeURIComponent(employeeId)}&locationId=${encodeURIComponent(locationId)}`;
    const response = await this.fetchWithRetry(url, { method: 'GET' });
    return response as HcmBalance[];
  }

  /**
   * Submit a time-off deduction to HCM with idempotency key.
   * Retries on 5xx; does NOT retry on 4xx.
   */
  async submitTimeOff(payload: HcmTimeOffPayload): Promise<HcmTimeOffResult> {
    const url = `${this.baseUrl}/hcm/time-off`;
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': payload.idempotencyKey,
      },
      body: JSON.stringify({
        employeeId: payload.employeeId,
        locationId: payload.locationId,
        leaveType: payload.leaveType,
        days: payload.days,
      }),
    });
    return response as HcmTimeOffResult;
  }

  /**
   * Notify HCM of a request cancellation (best-effort).
   */
  async cancelTimeOff(payload: HcmTimeOffPayload): Promise<void> {
    const url = `${this.baseUrl}/hcm/time-off/cancel`;
    try {
      await this.fetchWithRetry(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': payload.idempotencyKey,
        },
        body: JSON.stringify({
          employeeId: payload.employeeId,
          locationId: payload.locationId,
          leaveType: payload.leaveType,
          days: payload.days,
        }),
      });
    } catch {
      // Best-effort — ignore failures for cancellation notification
    }
  }

  /**
   * Submit a batch of balance updates to HCM.
   */
  async submitBatch(
    records: Array<{
      employeeId: string;
      locationId: string;
      leaveType: string;
      balance: number;
    }>,
  ): Promise<void> {
    const url = `${this.baseUrl}/hcm/batch`;
    await this.fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    });
  }

  /**
   * Core fetch helper with:
   * - Exponential backoff retry for 5xx errors
   * - AbortController timeout per attempt
   * - Non-retryable 4xx errors
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    attempt = 1,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;

    try {
      response = await fetch(url, { ...options, signal: controller.signal });
    } catch (err: any) {
      clearTimeout(timeoutId);

      const isAborted = err.name === 'AbortError';
      const isNetworkError =
        err.code === 'ECONNREFUSED' ||
        err.code === 'ETIMEDOUT' ||
        err.message?.includes('fetch failed');

      if ((isAborted || isNetworkError) && attempt < this.maxRetries) {
        await this.sleep(500 * attempt);
        return this.fetchWithRetry(url, options, attempt + 1);
      }

      const hcmErr = new HcmError(503, `HCM unreachable: ${err.message}`, 'HCM_UNAVAILABLE');
      (hcmErr as any).statusCode = 503;
      throw hcmErr;
    } finally {
      clearTimeout(timeoutId);
    }

    // Non-retryable client errors
    if (response.status >= 400 && response.status < 500) {
      let body: any = {};
      try {
        body = await response.json();
      } catch {
        // ignore parse error
      }
      throw new HcmError(
        response.status,
        body.message ?? `HCM responded with ${response.status}`,
        body.code,
      );
    }

    // Retryable server errors
    if (response.status >= 500) {
      if (attempt < this.maxRetries) {
        await this.sleep(500 * attempt);
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      throw new HcmError(503, `HCM service unavailable after ${this.maxRetries} attempts`, 'HCM_UNAVAILABLE');
    }

    // Success
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return {};
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
