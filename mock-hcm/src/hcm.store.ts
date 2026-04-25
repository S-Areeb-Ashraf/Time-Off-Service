import { v4 as uuidv4 } from 'uuid';

// ─── In-memory HCM Store ──────────────────────────────────────────────────────

interface BalanceRecord {
  employeeId: string;
  locationId: string;
  leaveType: string;
  balance: number;
}

type StoreKey = string;

const makeKey = (employeeId: string, locationId: string, leaveType: string): StoreKey =>
  `${employeeId}::${locationId}::${leaveType}`;

export class HcmStore {
  private balances: Map<StoreKey, BalanceRecord> = new Map();

  /**
   * Seed initial data so the mock is useful from the start.
   */
  seed() {
    const initialData: BalanceRecord[] = [
      { employeeId: 'EMP001', locationId: 'LOC_NYC', leaveType: 'ANNUAL', balance: 20 },
      { employeeId: 'EMP001', locationId: 'LOC_NYC', leaveType: 'SICK', balance: 10 },
      { employeeId: 'EMP001', locationId: 'LOC_NYC', leaveType: 'PERSONAL', balance: 5 },
      { employeeId: 'EMP002', locationId: 'LOC_LA', leaveType: 'ANNUAL', balance: 15 },
      { employeeId: 'EMP002', locationId: 'LOC_LA', leaveType: 'SICK', balance: 8 },
      { employeeId: 'EMP003', locationId: 'LOC_CHI', leaveType: 'ANNUAL', balance: 12 },
      { employeeId: 'EMP003', locationId: 'LOC_CHI', leaveType: 'MATERNITY', balance: 90 },
    ];

    for (const record of initialData) {
      const key = makeKey(record.employeeId, record.locationId, record.leaveType);
      this.balances.set(key, { ...record });
    }
  }

  /**
   * Get all leave balances for an employee at a location.
   */
  getBalances(employeeId: string, locationId: string): BalanceRecord[] {
    const results: BalanceRecord[] = [];
    for (const [key, record] of this.balances.entries()) {
      if (record.employeeId === employeeId && record.locationId === locationId) {
        results.push({ ...record });
      }
    }
    return results;
  }

  /**
   * Get a single balance record.
   */
  getBalance(employeeId: string, locationId: string, leaveType: string): BalanceRecord | null {
    const key = makeKey(employeeId, locationId, leaveType);
    return this.balances.get(key) ?? null;
  }

  /**
   * Deduct days from a balance. Returns { success, newBalance, ref }.
   */
  deductBalance(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
  ): { success: boolean; newBalance: number; ref: string; error?: string } {
    const key = makeKey(employeeId, locationId, leaveType);
    const record = this.balances.get(key);

    if (!record) {
      return { success: false, newBalance: 0, ref: '', error: `Employee/location/leaveType not found` };
    }

    if (record.balance < days) {
      return {
        success: false,
        newBalance: record.balance,
        ref: '',
        error: `Insufficient balance: available=${record.balance}, requested=${days}`,
      };
    }

    record.balance = parseFloat((record.balance - days).toFixed(4));
    return { success: true, newBalance: record.balance, ref: uuidv4() };
  }

  /**
   * Restore (add) days back to a balance.
   */
  restoreBalance(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
  ): void {
    const key = makeKey(employeeId, locationId, leaveType);
    const record = this.balances.get(key);
    if (record) {
      record.balance = parseFloat((record.balance + days).toFixed(4));
    }
  }

  /**
   * Upsert (batch update) a balance record.
   */
  upsertBalance(employeeId: string, locationId: string, leaveType: string, balance: number): void {
    const key = makeKey(employeeId, locationId, leaveType);
    const existing = this.balances.get(key);
    if (existing) {
      existing.balance = balance;
    } else {
      this.balances.set(key, { employeeId, locationId, leaveType, balance });
    }
  }

  /**
   * Add anniversary bonus days to a balance.
   */
  addAniversaryBonus(employeeId: string, locationId: string, bonus: number): void {
    for (const [, record] of this.balances.entries()) {
      if (record.employeeId === employeeId && record.locationId === locationId) {
        record.balance = parseFloat((record.balance + bonus).toFixed(4));
      }
    }
  }

  /**
   * Return all balances (for debugging/admin).
   */
  getAllBalances(): BalanceRecord[] {
    return Array.from(this.balances.values()).map((r) => ({ ...r }));
  }
}

export const store = new HcmStore();
store.seed();
