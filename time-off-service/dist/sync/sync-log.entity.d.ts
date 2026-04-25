export declare enum SyncTrigger {
    BATCH = "BATCH",
    REALTIME = "REALTIME",
    MANUAL = "MANUAL"
}
export declare class SyncLog {
    id: number;
    employeeId: string;
    locationId: string;
    leaveType: string;
    trigger: SyncTrigger;
    delta: number;
    previousBalance: number;
    newBalance: number;
    timestamp: Date;
}
