import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeOffBalance } from './balance.entity';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(TimeOffBalance)
    private readonly balanceRepo: Repository<TimeOffBalance>,
  ) {}

  /**
   * Get all balance records for an employee at a given location.
   */
  async getBalances(
    employeeId: string,
    locationId: string,
  ): Promise<TimeOffBalance[]> {
    return this.balanceRepo.find({ where: { employeeId, locationId } });
  }

  /**
   * Get a single balance record for a specific leave type.
   * Returns null if not found (caller decides whether to throw).
   */
  async getBalance(
    employeeId: string,
    locationId: string,
    leaveType: string,
  ): Promise<TimeOffBalance | null> {
    return this.balanceRepo.findOne({
      where: { employeeId, locationId, leaveType },
    });
  }

  /**
   * Deduct days from a balance using optimistic locking.
   * Retries up to maxRetries times if a version conflict is detected.
   * Throws if balance is insufficient or employee/location is unknown.
   */
  async deductBalance(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
    maxRetries = 3,
  ): Promise<TimeOffBalance> {
    let attempts = 0;

    while (attempts < maxRetries) {
      attempts++;

      const record = await this.balanceRepo.findOne({
        where: { employeeId, locationId, leaveType },
      });

      if (!record) {
        throw new NotFoundException(
          `No balance record found for employee=${employeeId}, location=${locationId}, leaveType=${leaveType}`,
        );
      }

      if (record.balance < days) {
        const err = new Error(
          `Insufficient balance: available=${record.balance}, requested=${days}`,
        );
        (err as any).code = 'INSUFFICIENT_BALANCE';
        throw err;
      }

      const newBalance = parseFloat((record.balance - days).toFixed(4));

      // Optimistic locking: only update if version hasn't changed
      const result = await this.balanceRepo
        .createQueryBuilder()
        .update(TimeOffBalance)
        .set({ balance: newBalance, version: record.version + 1 })
        .where('id = :id AND version = :version', {
          id: record.id,
          version: record.version,
        })
        .execute();

      if (result.affected && result.affected > 0) {
        // Successful write — return updated record
        return { ...record, balance: newBalance, version: record.version + 1 };
      }

      // Version conflict — retry
      if (attempts >= maxRetries) {
        const conflictErr = new Error(
          'Optimistic locking conflict: too many concurrent writes. Please retry.',
        );
        (conflictErr as any).status = 409;
        throw conflictErr;
      }

      // Brief pause before retry
      await new Promise((resolve) => setTimeout(resolve, 50 * attempts));
    }

    throw new Error('Unexpected deductBalance loop exit');
  }

  /**
   * Restore (add back) days to a balance. Used on request cancellation or rollback.
   */
  async restoreBalance(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
  ): Promise<TimeOffBalance> {
    const record = await this.balanceRepo.findOne({
      where: { employeeId, locationId, leaveType },
    });

    if (!record) {
      throw new NotFoundException(
        `No balance record found for employee=${employeeId}, location=${locationId}, leaveType=${leaveType}`,
      );
    }

    const newBalance = parseFloat((record.balance + days).toFixed(4));
    await this.balanceRepo.update(record.id, {
      balance: newBalance,
      version: record.version + 1,
    });

    return { ...record, balance: newBalance, version: record.version + 1 };
  }

  /**
   * Upsert a balance record (used during sync). Creates if not exists, updates otherwise.
   * Returns { previous, current, delta }.
   */
  async upsertBalance(
    employeeId: string,
    locationId: string,
    leaveType: string,
    newBalance: number,
  ): Promise<{ previous: number; current: number; delta: number; record: TimeOffBalance }> {
    let record = await this.balanceRepo.findOne({
      where: { employeeId, locationId, leaveType },
    });

    const previous = record?.balance ?? 0;

    if (!record) {
      record = this.balanceRepo.create({
        employeeId,
        locationId,
        leaveType,
        balance: newBalance,
        lastSyncedAt: new Date(),
        version: 1,
      });
      await this.balanceRepo.save(record);
    } else {
      await this.balanceRepo.update(record.id, {
        balance: newBalance,
        lastSyncedAt: new Date(),
        version: record.version + 1,
      });
      record.balance = newBalance;
      record.lastSyncedAt = new Date();
      record.version = record.version + 1;
    }

    const delta = parseFloat((newBalance - previous).toFixed(4));
    return { previous, current: newBalance, delta, record };
  }
}
