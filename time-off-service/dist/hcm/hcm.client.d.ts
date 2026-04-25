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
export declare class HcmError extends Error {
    readonly statusCode: number;
    readonly code?: string;
    constructor(statusCode: number, message: string, code?: string);
}
export declare class HcmClient {
    private readonly baseUrl;
    private readonly maxRetries;
    private readonly timeoutMs;
    constructor();
    getBalances(employeeId: string, locationId: string): Promise<HcmBalance[]>;
    submitTimeOff(payload: HcmTimeOffPayload): Promise<HcmTimeOffResult>;
    cancelTimeOff(payload: HcmTimeOffPayload): Promise<void>;
    submitBatch(records: Array<{
        employeeId: string;
        locationId: string;
        leaveType: string;
        balance: number;
    }>): Promise<void>;
    private fetchWithRetry;
    private sleep;
}
