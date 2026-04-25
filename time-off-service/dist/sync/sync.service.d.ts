import { Repository } from 'typeorm';
import { SyncLog, SyncTrigger } from './sync-log.entity';
import { BalanceService } from '../balance/balance.service';
import { HcmClient } from '../hcm/hcm.client';
import { BatchRecordDto } from './dto/batch-sync.dto';
export interface SyncResult {
    previous: number;
    current: number;
    delta: number;
    employeeId: string;
    locationId: string;
    leaveType: string;
}
export interface BatchIngestResult {
    processed: number;
    failed: number;
    failedDetails: Array<{
        record: BatchRecordDto;
        reason: string;
    }>;
    logs: SyncResult[];
}
export declare class SyncService {
    private readonly syncLogRepo;
    private readonly balanceService;
    private readonly hcmClient;
    constructor(syncLogRepo: Repository<SyncLog>, balanceService: BalanceService, hcmClient: HcmClient);
    ingestBatch(records: BatchRecordDto[]): Promise<BatchIngestResult>;
    syncRealtime(employeeId: string, locationId: string, trigger?: SyncTrigger): Promise<{
        synced: number;
        logs: SyncResult[];
    }>;
    getSyncLog(employeeId?: string, page?: number, limit?: number): Promise<{
        items: SyncLog[];
        total: number;
        page: number;
        limit: number;
    }>;
}
