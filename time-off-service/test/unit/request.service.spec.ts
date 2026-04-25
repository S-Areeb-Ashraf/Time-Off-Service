import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { RequestService } from '../../src/request/request.service';
import { TimeOffRequest, RequestStatus } from '../../src/request/request.entity';
import { BalanceService } from '../../src/balance/balance.service';
import { HcmClient } from '../../src/hcm/hcm.client';
import { TimeOffBalance } from '../../src/balance/balance.entity';

const makeBalance = (balance: number): TimeOffBalance => ({
  id: 1,
  employeeId: 'EMP001',
  locationId: 'LOC_NYC',
  leaveType: 'ANNUAL',
  balance,
  lastSyncedAt: new Date(),
  version: 1,
  updatedAt: new Date(),
});

const makeRequest = (status: RequestStatus = RequestStatus.PENDING): TimeOffRequest => ({
  id: 1,
  employeeId: 'EMP001',
  locationId: 'LOC_NYC',
  leaveType: 'ANNUAL',
  days: 3,
  status,
  hcmRef: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('RequestService', () => {
  let service: RequestService;
  let mockRequestRepo: any;
  let mockBalanceService: jest.Mocked<BalanceService>;
  let mockHcmClient: jest.Mocked<HcmClient>;

  beforeEach(async () => {
    mockRequestRepo = {
      create: jest.fn((data: any) => ({ id: 1, ...data })),
      save: jest.fn(async (entity: any) => entity),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      find: jest.fn(),
    };

    mockBalanceService = {
      getBalance: jest.fn(),
      getBalances: jest.fn(),
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
        RequestService,
        { provide: getRepositoryToken(TimeOffRequest), useValue: mockRequestRepo },
        { provide: BalanceService, useValue: mockBalanceService },
        { provide: HcmClient, useValue: mockHcmClient },
      ],
    }).compile();

    service = module.get<RequestService>(RequestService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── createRequest (happy path) ───────────────────────────────────────────────

  describe('createRequest()', () => {
    it('creates an APPROVED request and deducts balance when HCM confirms the time-off deduction', async () => {
      mockBalanceService.getBalance.mockResolvedValue(makeBalance(10));
      mockBalanceService.deductBalance.mockResolvedValue(makeBalance(7));
      mockHcmClient.submitTimeOff.mockResolvedValue({ ref: 'HCM-999', status: 'APPROVED' });
      mockRequestRepo.findOne.mockResolvedValue(makeRequest(RequestStatus.APPROVED));

      const result = await service.createRequest({
        employeeId: 'EMP001',
        locationId: 'LOC_NYC',
        leaveType: 'ANNUAL',
        days: 3,
      });

      expect(result.status).toBe(RequestStatus.APPROVED);
      expect(mockBalanceService.deductBalance).toHaveBeenCalledTimes(1);
      expect(mockHcmClient.submitTimeOff).toHaveBeenCalledTimes(1);
    });

    it('rolls back the local balance deduction and returns a REJECTED status when HCM rejects the request with 422', async () => {
      const hcmError: any = new Error('Insufficient balance in HCM');
      hcmError.statusCode = 422;

      mockBalanceService.getBalance.mockResolvedValue(makeBalance(10));
      mockBalanceService.deductBalance.mockResolvedValue(makeBalance(7));
      mockHcmClient.submitTimeOff.mockRejectedValue(hcmError);
      mockBalanceService.restoreBalance.mockResolvedValue(makeBalance(10));

      await expect(
        service.createRequest({
          employeeId: 'EMP001',
          locationId: 'LOC_NYC',
          leaveType: 'ANNUAL',
          days: 3,
        }),
      ).rejects.toThrow('HCM rejected request');

      expect(mockBalanceService.restoreBalance).toHaveBeenCalledTimes(1);
      expect(mockRequestRepo.update).toHaveBeenCalledWith(
        expect.any(Number),
        { status: RequestStatus.REJECTED },
      );
    });

    it('leaves the request in PENDING status and restores balance when HCM returns 503 Service Unavailable', async () => {
      const hcmError: any = new Error('HCM unreachable');
      hcmError.statusCode = 503;

      mockBalanceService.getBalance.mockResolvedValue(makeBalance(10));
      mockBalanceService.deductBalance.mockResolvedValue(makeBalance(7));
      mockHcmClient.submitTimeOff.mockRejectedValue(hcmError);
      mockBalanceService.restoreBalance.mockResolvedValue(makeBalance(10));
      mockRequestRepo.findOne.mockResolvedValue(makeRequest(RequestStatus.PENDING));

      const result = await service.createRequest({
        employeeId: 'EMP001',
        locationId: 'LOC_NYC',
        leaveType: 'ANNUAL',
        days: 3,
      });

      expect(result.status).toBe(RequestStatus.PENDING);
      expect(mockBalanceService.restoreBalance).toHaveBeenCalledTimes(1);
    });

    it('throws UnprocessableEntityException when the requested days exceed the available local balance', async () => {
      mockBalanceService.getBalance.mockResolvedValue(makeBalance(2));

      await expect(
        service.createRequest({
          employeeId: 'EMP001',
          locationId: 'LOC_NYC',
          leaveType: 'ANNUAL',
          days: 5,
        }),
      ).rejects.toThrow('Insufficient balance');
    });

    it('throws UnprocessableEntityException when no balance record exists for the given employee and location', async () => {
      mockBalanceService.getBalance.mockResolvedValue(null);

      await expect(
        service.createRequest({
          employeeId: 'UNKNOWN',
          locationId: 'LOC_NYC',
          leaveType: 'ANNUAL',
          days: 1,
        }),
      ).rejects.toThrow('No balance record found');
    });
  });

  // ─── cancelRequest ────────────────────────────────────────────────────────────

  describe('cancelRequest()', () => {
    it('successfully cancels a PENDING request, restores the balance, and notifies HCM', async () => {
      const pendingReq = makeRequest(RequestStatus.PENDING);
      mockRequestRepo.findOne
        .mockResolvedValueOnce(pendingReq)                          // initial find
        .mockResolvedValueOnce({ ...pendingReq, status: RequestStatus.CANCELLED }); // after update
      mockBalanceService.restoreBalance.mockResolvedValue(makeBalance(10));
      mockHcmClient.cancelTimeOff.mockResolvedValue(undefined);

      const result = await service.cancelRequest(1);

      expect(result.status).toBe(RequestStatus.CANCELLED);
      expect(mockBalanceService.restoreBalance).toHaveBeenCalledTimes(1);
      expect(mockRequestRepo.update).toHaveBeenCalledWith(1, { status: RequestStatus.CANCELLED });
    });

    it('throws ConflictException with 409 when attempting to cancel an already APPROVED request', async () => {
      mockRequestRepo.findOne.mockResolvedValue(makeRequest(RequestStatus.APPROVED));

      await expect(service.cancelRequest(1)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when attempting to cancel an already CANCELLED request', async () => {
      mockRequestRepo.findOne.mockResolvedValue(makeRequest(RequestStatus.CANCELLED));

      await expect(service.cancelRequest(1)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when attempting to cancel a REJECTED request', async () => {
      mockRequestRepo.findOne.mockResolvedValue(makeRequest(RequestStatus.REJECTED));

      await expect(service.cancelRequest(1)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when attempting to cancel a request that does not exist', async () => {
      mockRequestRepo.findOne.mockResolvedValue(null);

      await expect(service.cancelRequest(9999)).rejects.toThrow(NotFoundException);
    });

    it('still completes the cancellation and restores balance even when the HCM cancellation notification fails', async () => {
      const pendingReq = makeRequest(RequestStatus.PENDING);
      mockRequestRepo.findOne
        .mockResolvedValueOnce(pendingReq)
        .mockResolvedValueOnce({ ...pendingReq, status: RequestStatus.CANCELLED });
      mockBalanceService.restoreBalance.mockResolvedValue(makeBalance(10));
      mockHcmClient.cancelTimeOff.mockRejectedValue(new Error('HCM down'));

      const result = await service.cancelRequest(1);
      expect(result.status).toBe(RequestStatus.CANCELLED);
    });
  });

  // ─── getRequest ───────────────────────────────────────────────────────────────

  describe('getRequest()', () => {
    it('returns the request entity when a request with the given ID exists', async () => {
      const req = makeRequest(RequestStatus.APPROVED);
      mockRequestRepo.findOne.mockResolvedValue(req);

      const result = await service.getRequest(1);
      expect(result.id).toBe(1);
      expect(result.status).toBe(RequestStatus.APPROVED);
    });

    it('throws NotFoundException when no request with the given ID is found in the database', async () => {
      mockRequestRepo.findOne.mockResolvedValue(null);

      await expect(service.getRequest(9999)).rejects.toThrow(NotFoundException);
    });
  });
});
