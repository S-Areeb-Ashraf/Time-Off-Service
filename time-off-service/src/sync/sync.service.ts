import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
  failedDetails: Array<{ record: BatchRecordDto; reason: string }>;
  logs: SyncResult[];
}

@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(SyncLog)
    private readonly syncLogRepo: Repository<SyncLog>,
    private readonly balanceService: BalanceService,
    private readonly hcmClient: HcmClient,
  ) {}

  /**
   * Ingest a full batch payload from HCM.
   * Each record is processed independently — partial failures do not block valid records.
   */
  async ingestBatch(records: BatchRecordDto[]): Promise<BatchIngestResult> {
    const logs: SyncResult[] = [];
    const failedDetails: Array<{ record: BatchRecordDto; reason: string }> = [];

    for (const record of records) {
      try {
        const { previous, current, delta } =
          await this.balanceService.upsertBalance(
            record.employeeId,
            record.locationId,
            record.leaveType,
            record.balance,
          );

        // Record sync log
        await this.syncLogRepo.save(
          this.syncLogRepo.create({
            employeeId: record.employeeId,
            locationId: record.locationId,
            leaveType: record.leaveType,
            trigger: SyncTrigger.BATCH,
            delta,
            previousBalance: previous,
            newBalance: current,
          }),
        );

        logs.push({
          employeeId: record.employeeId,
          locationId: record.locationId,
          leaveType: record.leaveType,
          previous,
          current,
          delta,
        });
      } catch (err: any) {
        failedDetails.push({ record, reason: err.message });
      }
    }

    return {
      processed: logs.length,
      failed: failedDetails.length,
      failedDetails,
      logs,
    };
  }

  /**
   * Trigger a realtime sync for one employee+location.
   * Fetches current balances from HCM and updates local records.
   */
  async syncRealtime(
    employeeId: string,
    locationId: string,
    trigger: SyncTrigger = SyncTrigger.REALTIME,
  ): Promise<{ synced: number; logs: SyncResult[] }> {
    const hcmBalances = await this.hcmClient.getBalances(
      employeeId,
      locationId,
    );

    const logs: SyncResult[] = [];

    for (const hcmBalance of hcmBalances) {
      const { previous, current, delta } = await this.balanceService.upsertBalance(
        employeeId,
        locationId,
        hcmBalance.leaveType,
        hcmBalance.balance,
      );

      await this.syncLogRepo.save(
        this.syncLogRepo.create({
          employeeId,
          locationId,
          leaveType: hcmBalance.leaveType,
          trigger,
          delta,
          previousBalance: previous,
          newBalance: current,
        }),
      );

      logs.push({
        employeeId,
        locationId,
        leaveType: hcmBalance.leaveType,
        previous,
        current,
        delta,
      });
    }

    return { synced: logs.length, logs };
  }

  /**
   * Get paginated sync log entries, optionally filtered by employeeId.
   */
  async getSyncLog(
    employeeId?: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: SyncLog[]; total: number; page: number; limit: number }> {
    const where = employeeId ? { employeeId } : {};
    const [items, total] = await this.syncLogRepo.findAndCount({
      where,
      order: { timestamp: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }
}
