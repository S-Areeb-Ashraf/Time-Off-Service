import { Controller, Get, Param } from '@nestjs/common';
import { BalanceService } from './balance.service';

@Controller('time-off/balance')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  /**
   * GET /time-off/balance/:employeeId/:locationId
   * Returns all leave balances for an employee at a location.
   */
  @Get(':employeeId/:locationId')
  async getBalances(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.balanceService.getBalances(employeeId, locationId);
  }
}
