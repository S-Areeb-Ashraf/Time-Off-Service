export declare class BatchRecordDto {
    employeeId: string;
    locationId: string;
    leaveType: string;
    balance: number;
}
export declare class BatchSyncDto {
    records: BatchRecordDto[];
}
export declare class RealtimeSyncDto {
    employeeId: string;
    locationId: string;
}
