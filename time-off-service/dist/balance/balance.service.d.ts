import { Repository } from 'typeorm';
import { TimeOffBalance } from './balance.entity';
export declare class BalanceService {
    private readonly balanceRepo;
    constructor(balanceRepo: Repository<TimeOffBalance>);
    getBalances(employeeId: string, locationId: string): Promise<TimeOffBalance[]>;
    getBalance(employeeId: string, locationId: string, leaveType: string): Promise<TimeOffBalance | null>;
    deductBalance(employeeId: string, locationId: string, leaveType: string, days: number, maxRetries?: number): Promise<TimeOffBalance>;
    restoreBalance(employeeId: string, locationId: string, leaveType: string, days: number): Promise<TimeOffBalance>;
    upsertBalance(employeeId: string, locationId: string, leaveType: string, newBalance: number): Promise<{
        previous: number;
        current: number;
        delta: number;
        record: TimeOffBalance;
    }>;
}
