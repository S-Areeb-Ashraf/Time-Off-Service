/**
 * Central API client wrapper.
 * All requests go through this wrapper to ensure consistent error handling
 * and base URL management from environment variables.
 *
 * Uses native fetch ONLY — no axios.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export interface ApiEnvelope<T> {
  data: T;
  error: { message: string; code: string; details: string[] } | null;
  meta: { timestamp: string; requestId: string };
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: string[] = [],
    public readonly status: number = 500,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const envelope: ApiEnvelope<T> = await response.json();

  if (!response.ok || envelope.error) {
    throw new ApiError(
      envelope.error?.code ?? 'UNKNOWN_ERROR',
      envelope.error?.message ?? `Request failed with status ${response.status}`,
      envelope.error?.details ?? [],
      response.status,
    );
  }

  return envelope.data;
}

export const apiClient = {
  get: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { method: 'GET', ...init }),

  post: <T>(path: string, body: unknown, init?: RequestInit) =>
    request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      ...init,
    }),

  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...init,
    }),

  delete: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { method: 'DELETE', ...init }),
};
