import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SyncService } from '../../src/sync/sync.service';
import { SyncLog, SyncTrigger } from '../../src/sync/sync-log.entity';
import { BalanceService } from '../../src/balance/balance.service';
import { HcmClient } from '../../src/hcm/hcm.client';
import { TimeOffBalance } from '../../src/balance/balance.entity';

const makeUpsertResult = (previous: number, current: number) => ({
  previous,
  current,
  delta: current - previous,
  record: {} as TimeOffBalance,
});

describe('SyncService', () => {
  let service: SyncService;
  let mockSyncLogRepo: any;
  let mockBalanceService: jest.Mocked<BalanceService>;
  let mockHcmClient: jest.Mocked<HcmClient>;

  beforeEach(async () => {
    mockSyncLogRepo = {
      find: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data: any) => data),
      save: jest.fn(),
    };

    mockBalanceService = {
      getBalances: jest.fn(),
      getBalance: jest.fn(),
      deductBalance: jest.fn(),
      restoreBalance: jest.fn(),
      upsertBalance: jest.fn(),
    } as any;

    mockHcmClient = {
      getBalances: jest.fn(),
      submitTimeOff: jest.fn(),
      cancelTimeOff: jest.fn(),
      submitBatch: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: getRepositoryToken(SyncLog), useValue: mockSyncLogRepo },
        { provide: BalanceService, useValue: mockBalanceService },
        { provide: HcmClient, useValue: mockHcmClient },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── ingestBatch ─────────────────────────────────────────────────────────────

  describe('ingestBatch()', () => {
    it('upserts all valid records and creates a sync log entry for each processed record', async () => {
      const records = [
        { employeeId: 'EMP001', locationId: 'LOC_NYC', leaveType: 'ANNUAL', balance: 15 },
        { employeeId: 'EMP002', locationId: 'LOC_LA', leaveType: 'SICK', balance: 5 },
      ];

      mockBalanceService.upsertBalance
        .mockResolvedValueOnce(makeUpsertResult(10, 15))
        .mockResolvedValueOnce(makeUpsertResult(0, 5));

      mockSyncLogRepo.save.mockResolvedValue({});

      const result = await service.ingestBatch(records);

      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockBalanceService.upsertBalance).toHaveBeenCalledTimes(2);
      expect(mockSyncLogRepo.save).toHaveBeenCalledTimes(2);
    });

    it('records the correct positive and negative deltas in sync logs when balances change', async () => {
      const records = [
        { employeeId: 'EMP001', locationId: 'LOC_NYC', leaveType: 'ANNUAL', balance: 20 },
        { employeeId: 'EMP002', locationId: 'LOC_LA', leaveType: 'SICK', balance: 3 },
      ];

      mockBalanceService.upsertBalance
        .mockResolvedValueOnce(makeUpsertResult(10, 20)) // delta = +10
        .mockResolvedValueOnce(makeUpsertResult(7, 3));  // delta = -4

      mockSyncLogRepo.save.mockResolvedValue({});

      const result = await service.ingestBatch(records);

      expect(result.logs[0].delta).toBe(10);
      expect(result.logs[1].delta).toBe(-4);
    });

    it('continues processing valid records and reports only the failed records when some records fail during batch ingest', async () => {
      const records = [
        { employeeId: 'EMP001', locationId: 'LOC_NYC', leaveType: 'ANNUAL', balance: 15 },
        { employeeId: 'BAD', locationId: 'INVALID', leaveType: 'ANNUAL', balance: -1 },
        { employeeId: 'EMP003', locationId: 'LOC_CHI', leaveType: 'SICK', balance: 8 },
      ];

      mockBalanceService.upsertBalance
        .mockResolvedValueOnce(makeUpsertResult(10, 15))
        .mockRejectedValueOnce(new Error('DB constraint violation'))
        .mockResolvedValueOnce(makeUpsertResult(0, 8));

      mockSyncLogRepo.save.mockResolvedValue({});

      const result = await service.ingestBatch(records);

      expect(result.processed).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.failedDetails[0].record.employeeId).toBe('BAD');
    });

    it('returns zero processed records and all records in failed list when every batch record fails', async () => {
      const records = [
        { employeeId: 'EMP001', locationId: 'LOC_NYC', leaveType: 'ANNUAL', balance: 15 },
      ];
      mockBalanceService.upsertBalance.mockRejectedValue(new Error('DB error'));
      mockSyncLogRepo.save.mockResolvedValue({});

      const result = await service.ingestBatch(records);
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
    });
  });

  // ─── syncRealtime ─────────────────────────────────────────────────────────────

  describe('syncRealtime()', () => {
    it('fetches balances from HCM, upserts each locally, and returns sync results including deltas', async () => {
      const hcmBalances = [
        { employeeId: 'EMP001', locationId: 'LOC_NYC', leaveType: 'ANNUAL', balance: 12 },
        { employeeId: 'EMP001', locationId: 'LOC_NYC', leaveType: 'SICK', balance: 5 },
      ];
      mockHcmClient.getBalances.mockResolvedValue(hcmBalances);
      mockBalanceService.upsertBalance
        .mockResolvedValueOnce(makeUpsertResult(10, 12))
        .mockResolvedValueOnce(makeUpsertResult(5, 5));
      mockSyncLogRepo.save.mockResolvedValue({});

      const result = await service.syncRealtime('EMP001', 'LOC_NYC', SyncTrigger.REALTIME);

      expect(result.synced).toBe(2);
      expect(result.logs[0].delta).toBe(2);
      expect(result.logs[1].delta).toBe(0);
    });

    it('overwrites a stale local balance with the authoritative HCM value during realtime sync', async () => {
      mockHcmClient.getBalances.mockResolvedValue([
        { employeeId: 'EMP001', locationId: 'LOC_NYC', leaveType: 'ANNUAL', balance: 25 },
      ]);
      mockBalanceService.upsertBalance.mockResolvedValue(makeUpsertResult(5, 25));
      mockSyncLogRepo.save.mockResolvedValue({});

      const result = await service.syncRealtime('EMP001', 'LOC_NYC', SyncTrigger.MANUAL);

      expect(result.logs[0].previous).toBe(5);
      expect(result.logs[0].current).toBe(25);
      expect(result.logs[0].delta).toBe(20);
    });
  });

  // ─── getSyncLog ───────────────────────────────────────────────────────────────

  describe('getSyncLog()', () => {
    it('returns a paginated list of sync log entries when no employeeId filter is provided', async () => {
      mockSyncLogRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.getSyncLog(undefined, 1, 20);
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('filters sync log entries by employeeId when an employeeId filter is provided', async () => {
      const logEntry = { id: 1, employeeId: 'EMP001', trigger: SyncTrigger.BATCH };
      mockSyncLogRepo.findAndCount.mockResolvedValue([[logEntry], 1]);

      const result = await service.getSyncLog('EMP001', 1, 10);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].employeeId).toBe('EMP001');
    });
  });
});
