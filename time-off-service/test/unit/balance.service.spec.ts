import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { BalanceService } from '../../src/balance/balance.service';
import { TimeOffBalance } from '../../src/balance/balance.entity';

const makeMockBalance = (overrides: Partial<TimeOffBalance> = {}): TimeOffBalance => ({
  id: 1,
  employeeId: 'EMP001',
  locationId: 'LOC_NYC',
  leaveType: 'ANNUAL',
  balance: 10,
  lastSyncedAt: new Date(),
  version: 1,
  updatedAt: new Date(),
  ...overrides,
});

describe('BalanceService', () => {
  let service: BalanceService;
  let mockRepo: any;

  beforeEach(async () => {
    mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        { provide: getRepositoryToken(TimeOffBalance), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── deductBalance ───────────────────────────────────────────────────────────

  describe('deductBalance()', () => {
    it('successfully deducts days when balance is sufficient and no version conflict occurs', async () => {
      const balance = makeMockBalance({ balance: 10, version: 1 });
      mockRepo.findOne.mockResolvedValue(balance);

      const qb: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.deductBalance('EMP001', 'LOC_NYC', 'ANNUAL', 3);

      expect(result.balance).toBe(7);
      expect(result.version).toBe(2);
      expect(qb.execute).toHaveBeenCalledTimes(1);
    });

    it('throws an error with code INSUFFICIENT_BALANCE when requested days exceed available balance', async () => {
      const balance = makeMockBalance({ balance: 5, version: 1 });
      mockRepo.findOne.mockResolvedValue(balance);

      await expect(
        service.deductBalance('EMP001', 'LOC_NYC', 'ANNUAL', 10),
      ).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
    });

    it('throws NotFoundException when no balance record exists for the given employee, location, and leaveType', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deductBalance('UNKNOWN', 'LOC_NYC', 'ANNUAL', 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('retries and succeeds when an optimistic lock conflict is detected on the first attempt', async () => {
      const balance = makeMockBalance({ balance: 10, version: 1 });
      mockRepo.findOne
        .mockResolvedValueOnce(balance)   // first read → conflict
        .mockResolvedValueOnce({ ...balance, version: 2 }); // retry read → success

      const qb: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest
          .fn()
          .mockResolvedValueOnce({ affected: 0 }) // conflict
          .mockResolvedValueOnce({ affected: 1 }), // success
      };
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.deductBalance('EMP001', 'LOC_NYC', 'ANNUAL', 3);
      expect(result.balance).toBe(7);
    });

    it('throws a 409 conflict error when optimistic lock conflicts persist across all max retry attempts', async () => {
      const balance = makeMockBalance({ balance: 10, version: 1 });
      mockRepo.findOne.mockResolvedValue(balance);

      const qb: any = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.deductBalance('EMP001', 'LOC_NYC', 'ANNUAL', 3, 2),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  // ─── restoreBalance ──────────────────────────────────────────────────────────

  describe('restoreBalance()', () => {
    it('adds back the requested days to the balance and increments the version', async () => {
      const balance = makeMockBalance({ balance: 5, version: 3 });
      mockRepo.findOne.mockResolvedValue(balance);
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.restoreBalance('EMP001', 'LOC_NYC', 'ANNUAL', 3);
      expect(result.balance).toBe(8);
      expect(result.version).toBe(4);
      expect(mockRepo.update).toHaveBeenCalledWith(1, { balance: 8, version: 4 });
    });

    it('throws NotFoundException when no balance record exists to restore', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(
        service.restoreBalance('UNKNOWN', 'LOC_NYC', 'ANNUAL', 3),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── upsertBalance ───────────────────────────────────────────────────────────

  describe('upsertBalance()', () => {
    it('creates a new balance record when no existing record is found for the employee+location+leaveType', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const createdRecord = makeMockBalance({ balance: 15, version: 1 });
      mockRepo.create.mockReturnValue(createdRecord);
      mockRepo.save.mockResolvedValue(createdRecord);

      const result = await service.upsertBalance('EMP001', 'LOC_NYC', 'ANNUAL', 15);
      expect(result.current).toBe(15);
      expect(result.previous).toBe(0);
      expect(result.delta).toBe(15);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
    });

    it('updates the existing balance record and calculates the correct delta when a record already exists', async () => {
      const existing = makeMockBalance({ balance: 10, version: 2 });
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.upsertBalance('EMP001', 'LOC_NYC', 'ANNUAL', 12);
      expect(result.previous).toBe(10);
      expect(result.current).toBe(12);
      expect(result.delta).toBe(2);
      expect(mockRepo.update).toHaveBeenCalledTimes(1);
    });
  });
});
