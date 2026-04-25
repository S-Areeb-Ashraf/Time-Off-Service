import { apiClient } from './apiClient';

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface TimeOffRequest {
  id: number;
  employeeId: string;
  locationId: string;
  leaveType: string;
  days: number;
  status: RequestStatus;
  hcmRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRequestPayload {
  employeeId: string;
  locationId: string;
  leaveType: string;
  days: number;
}

export function fetchRequests(employeeId?: string): Promise<TimeOffRequest[]> {
  const query = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : '';
  return apiClient.get<TimeOffRequest[]>(`/time-off/request${query}`);
}

export function fetchRequest(id: number): Promise<TimeOffRequest> {
  return apiClient.get<TimeOffRequest>(`/time-off/request/${id}`);
}

export function createRequest(payload: CreateRequestPayload): Promise<TimeOffRequest> {
  return apiClient.post<TimeOffRequest>('/time-off/request', payload);
}

export function cancelRequest(id: number): Promise<TimeOffRequest> {
  return apiClient.patch<TimeOffRequest>(`/time-off/request/${id}/cancel`);
}
