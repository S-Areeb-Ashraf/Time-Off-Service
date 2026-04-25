import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeOffRequest, RequestStatus } from './request.entity';
import { CreateRequestDto } from './dto/create-request.dto';
import { BalanceService } from '../balance/balance.service';
import { HcmClient } from '../hcm/hcm.client';

@Injectable()
export class RequestService {
  constructor(
    @InjectRepository(TimeOffRequest)
    private readonly requestRepo: Repository<TimeOffRequest>,
    private readonly balanceService: BalanceService,
    private readonly hcmClient: HcmClient,
  ) {}

  /**
   * Submit a new time-off request.
   * Flow:
   *   1. Check local balance exists and is sufficient
   *   2. Deduct locally (optimistic)
   *   3. Submit to HCM
   *   4. If HCM approves → mark APPROVED, store hcmRef
   *   5. If HCM rejects → roll back local deduction, mark REJECTED
   *   6. If HCM unreachable → keep PENDING (deduction NOT applied until confirmed)
   */
  async createRequest(dto: CreateRequestDto): Promise<TimeOffRequest> {
    const { employeeId, locationId, leaveType, days } = dto;

    // Step 1: Verify balance exists and is sufficient
    const balance = await this.balanceService.getBalance(
      employeeId,
      locationId,
      leaveType,
    );

    if (!balance) {
      throw new UnprocessableEntityException(
        `No balance record found for employee=${employeeId}, location=${locationId}, leaveType=${leaveType}. ` +
          'Please ensure a sync has been performed.',
      );
    }

    if (balance.balance < days) {
      throw new UnprocessableEntityException(
        `Insufficient balance: available=${balance.balance}, requested=${days}`,
      );
    }

    // Step 2: Create the request record as PENDING
    const request = this.requestRepo.create({
      employeeId,
      locationId,
      leaveType,
      days,
      status: RequestStatus.PENDING,
      hcmRef: null,
    });
    await this.requestRepo.save(request);

    // Step 3: Deduct locally (optimistic)
    try {
      await this.balanceService.deductBalance(
        employeeId,
        locationId,
        leaveType,
        days,
      );
    } catch (err: any) {
      if (err.code === 'INSUFFICIENT_BALANCE') {
        await this.requestRepo.update(request.id, {
          status: RequestStatus.REJECTED,
        });
        throw new UnprocessableEntityException(err.message);
      }
      // Other errors (conflict) — mark PENDING and let sync resolve
      return this.requestRepo.findOne({ where: { id: request.id } });
    }

    // Step 4: Notify HCM
    try {
      const hcmResult = await this.hcmClient.submitTimeOff({
        employeeId,
        locationId,
        leaveType,
        days,
        idempotencyKey: `req-${request.id}`,
      });

      // HCM approved
      await this.requestRepo.update(request.id, {
        status: RequestStatus.APPROVED,
        hcmRef: hcmResult.ref ?? null,
      });

      return this.requestRepo.findOne({ where: { id: request.id } });
    } catch (err: any) {
      // HCM rejected the request (e.g. insufficient balance in HCM)
      if (err.statusCode === 422 || err.statusCode === 400) {
        // Roll back local deduction
        await this.balanceService.restoreBalance(
          employeeId,
          locationId,
          leaveType,
          days,
        );
        await this.requestRepo.update(request.id, {
          status: RequestStatus.REJECTED,
        });
        throw new UnprocessableEntityException(
          `HCM rejected request: ${err.message}`,
        );
      }

      // HCM unreachable (503) — leave as PENDING, do NOT restore balance
      // The next sync cycle will resolve PENDING requests
      if (err.statusCode === 503 || err.code === 'HCM_UNAVAILABLE') {
        // Restore balance since we can't confirm with HCM
        await this.balanceService.restoreBalance(
          employeeId,
          locationId,
          leaveType,
          days,
        );
        // Request stays PENDING
        return this.requestRepo.findOne({ where: { id: request.id } });
      }

      // Unknown error — restore balance, mark rejected
      await this.balanceService.restoreBalance(
        employeeId,
        locationId,
        leaveType,
        days,
      );
      await this.requestRepo.update(request.id, {
        status: RequestStatus.REJECTED,
      });
      throw new HttpException(
        `Unexpected error submitting to HCM: ${err.message}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Get a request by ID.
   */
  async getRequest(id: number): Promise<TimeOffRequest> {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException(`Request with id=${id} not found`);
    }
    return request;
  }

  /**
   * Cancel a PENDING request.
   * Restores balance and notifies HCM of cancellation.
   */
  async cancelRequest(id: number): Promise<TimeOffRequest> {
    const request = await this.requestRepo.findOne({ where: { id } });

    if (!request) {
      throw new NotFoundException(`Request with id=${id} not found`);
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new ConflictException(
        `Cannot cancel request with status=${request.status}. Only PENDING requests can be cancelled.`,
      );
    }

    // Restore local balance
    await this.balanceService.restoreBalance(
      request.employeeId,
      request.locationId,
      request.leaveType,
      request.days,
    );

    // Notify HCM of cancellation (best-effort, don't fail if HCM is down)
    try {
      await this.hcmClient.cancelTimeOff({
        employeeId: request.employeeId,
        locationId: request.locationId,
        leaveType: request.leaveType,
        days: request.days,
        idempotencyKey: `cancel-${request.id}`,
      });
    } catch {
      // HCM notification failure is non-blocking for cancellation
    }

    await this.requestRepo.update(id, { status: RequestStatus.CANCELLED });
    return this.requestRepo.findOne({ where: { id } });
  }

  /**
   * List all requests for an employee (optional filter).
   */
  async listRequests(employeeId?: string): Promise<TimeOffRequest[]> {
    if (employeeId) {
      return this.requestRepo.find({ where: { employeeId }, order: { createdAt: 'DESC' } });
    }
    return this.requestRepo.find({ order: { createdAt: 'DESC' } });
  }
}
