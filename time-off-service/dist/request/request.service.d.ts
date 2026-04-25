import { Repository } from 'typeorm';
import { TimeOffRequest } from './request.entity';
import { CreateRequestDto } from './dto/create-request.dto';
import { BalanceService } from '../balance/balance.service';
import { HcmClient } from '../hcm/hcm.client';
export declare class RequestService {
    private readonly requestRepo;
    private readonly balanceService;
    private readonly hcmClient;
    constructor(requestRepo: Repository<TimeOffRequest>, balanceService: BalanceService, hcmClient: HcmClient);
    createRequest(dto: CreateRequestDto): Promise<TimeOffRequest>;
    getRequest(id: number): Promise<TimeOffRequest>;
    cancelRequest(id: number): Promise<TimeOffRequest>;
    listRequests(employeeId?: string): Promise<TimeOffRequest[]>;
}
