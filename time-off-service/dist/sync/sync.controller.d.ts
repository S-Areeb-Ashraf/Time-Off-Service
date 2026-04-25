import { SyncService } from './sync.service';
import { BatchSyncDto, RealtimeSyncDto } from './dto/batch-sync.dto';
export declare class SyncController {
    private readonly syncService;
    constructor(syncService: SyncService);
    syncRealtime(dto: RealtimeSyncDto): Promise<{
        synced: number;
        logs: import("./sync.service").SyncResult[];
    }>;
    ingestBatch(dto: BatchSyncDto): Promise<import("./sync.service").BatchIngestResult>;
    getSyncLog(employeeId?: string, page?: number, limit?: number): Promise<{
        items: import("./sync-log.entity").SyncLog[];
        total: number;
        page: number;
        limit: number;
    }>;
}
