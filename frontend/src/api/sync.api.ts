import { apiClient } from './apiClient';

export type SyncTrigger = 'BATCH' | 'REALTIME' | 'MANUAL';

export interface SyncLog {
  id: number;
  employeeId: string;
  locationId: string;
  leaveType: string;
  trigger: SyncTrigger;
  delta: number;
  previousBalance: number;
  newBalance: number;
  timestamp: string;
}

export interface SyncLogPage {
  items: SyncLog[];
  total: number;
  page: number;
  limit: number;
}

export interface SyncResult {
  employeeId: string;
  locationId: string;
  leaveType: string;
  previous: number;
  current: number;
  delta: number;
}

export interface RealtimeSyncResponse {
  synced: number;
  logs: SyncResult[];
}

export interface BatchRecord {
  employeeId: string;
  locationId: string;
  leaveType: string;
  balance: number;
}

export interface BatchSyncResponse {
  processed: number;
  failed: number;
  failedDetails: Array<{ record: BatchRecord; reason: string }>;
  logs: SyncResult[];
}

export function triggerRealtimeSync(
  employeeId: string,
  locationId: string,
): Promise<RealtimeSyncResponse> {
  return apiClient.post<RealtimeSyncResponse>('/time-off/sync/realtime', {
    employeeId,
    locationId,
  });
}

export function ingestBatch(records: BatchRecord[]): Promise<BatchSyncResponse> {
  return apiClient.post<BatchSyncResponse>('/time-off/sync/batch', { records });
}

export function fetchSyncLog(
  employeeId?: string,
  page = 1,
  limit = 20,
): Promise<SyncLogPage> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (employeeId) params.set('employeeId', employeeId);
  return apiClient.get<SyncLogPage>(`/time-off/sync/log?${params.toString()}`);
}
