import { BalanceService } from './balance.service';
export declare class BalanceController {
    private readonly balanceService;
    constructor(balanceService: BalanceService);
    getBalances(employeeId: string, locationId: string): Promise<import("./balance.entity").TimeOffBalance[]>;
}
