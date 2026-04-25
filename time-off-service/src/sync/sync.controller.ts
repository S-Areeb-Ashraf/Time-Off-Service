import {
  Controller,
  Post,
  Get,
  Body,
  Query,
} from '@nestjs/common';
import { SyncService } from './sync.service';
import { BatchSyncDto, RealtimeSyncDto } from './dto/batch-sync.dto';
import { SyncTrigger } from './sync-log.entity';

@Controller('time-off/sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * POST /time-off/sync/realtime
   * Trigger an immediate HCM sync for one employee+location.
   */
  @Post('realtime')
  async syncRealtime(@Body() dto: RealtimeSyncDto) {
    return this.syncService.syncRealtime(
      dto.employeeId,
      dto.locationId,
      SyncTrigger.MANUAL,
    );
  }

  /**
   * POST /time-off/sync/batch
   * Ingest a full HCM batch payload.
   */
  @Post('batch')
  async ingestBatch(@Body() dto: BatchSyncDto) {
    return this.syncService.ingestBatch(dto.records);
  }

  /**
   * GET /time-off/sync/log
   * Get sync log history with optional employeeId filter and pagination.
   */
  @Get('log')
  async getSyncLog(
    @Query('employeeId') employeeId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.syncService.getSyncLog(
      employeeId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }
}
