import { RequestService } from './request.service';
import { CreateRequestDto } from './dto/create-request.dto';
export declare class RequestController {
    private readonly requestService;
    constructor(requestService: RequestService);
    createRequest(dto: CreateRequestDto): Promise<import("./request.entity").TimeOffRequest>;
    listRequests(employeeId?: string): Promise<import("./request.entity").TimeOffRequest[]>;
    getRequest(id: number): Promise<import("./request.entity").TimeOffRequest>;
    cancelRequest(id: number): Promise<import("./request.entity").TimeOffRequest>;
}
