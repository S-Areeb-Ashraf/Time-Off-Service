import { apiClient } from './apiClient';

export interface TimeOffBalance {
  id: number;
  employeeId: string;
  locationId: string;
  leaveType: string;
  balance: number;
  lastSyncedAt: string;
  version: number;
}

export function fetchBalances(
  employeeId: string,
  locationId: string,
): Promise<TimeOffBalance[]> {
  return apiClient.get<TimeOffBalance[]>(
    `/time-off/balance/${encodeURIComponent(employeeId)}/${encodeURIComponent(locationId)}`,
  );
}
