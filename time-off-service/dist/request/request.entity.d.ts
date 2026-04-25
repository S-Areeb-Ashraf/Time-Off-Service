export declare enum RequestStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    CANCELLED = "CANCELLED"
}
export declare class TimeOffRequest {
    id: number;
    employeeId: string;
    locationId: string;
    leaveType: string;
    days: number;
    status: RequestStatus;
    hcmRef: string | null;
    createdAt: Date;
    updatedAt: Date;
}
