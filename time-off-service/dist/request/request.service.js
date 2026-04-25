"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const request_entity_1 = require("./request.entity");
const balance_service_1 = require("../balance/balance.service");
const hcm_client_1 = require("../hcm/hcm.client");
let RequestService = class RequestService {
    constructor(requestRepo, balanceService, hcmClient) {
        this.requestRepo = requestRepo;
        this.balanceService = balanceService;
        this.hcmClient = hcmClient;
    }
    async createRequest(dto) {
        const { employeeId, locationId, leaveType, days } = dto;
        const balance = await this.balanceService.getBalance(employeeId, locationId, leaveType);
        if (!balance) {
            throw new common_1.UnprocessableEntityException(`No balance record found for employee=${employeeId}, location=${locationId}, leaveType=${leaveType}. ` +
                'Please ensure a sync has been performed.');
        }
        if (balance.balance < days) {
            throw new common_1.UnprocessableEntityException(`Insufficient balance: available=${balance.balance}, requested=${days}`);
        }
        const request = this.requestRepo.create({
            employeeId,
            locationId,
            leaveType,
            days,
            status: request_entity_1.RequestStatus.PENDING,
            hcmRef: null,
        });
        await this.requestRepo.save(request);
        try {
            await this.balanceService.deductBalance(employeeId, locationId, leaveType, days);
        }
        catch (err) {
            if (err.code === 'INSUFFICIENT_BALANCE') {
                await this.requestRepo.update(request.id, {
                    status: request_entity_1.RequestStatus.REJECTED,
                });
                throw new common_1.UnprocessableEntityException(err.message);
            }
            return this.requestRepo.findOne({ where: { id: request.id } });
        }
        try {
            const hcmResult = await this.hcmClient.submitTimeOff({
                employeeId,
                locationId,
                leaveType,
                days,
                idempotencyKey: `req-${request.id}`,
            });
            await this.requestRepo.update(request.id, {
                status: request_entity_1.RequestStatus.APPROVED,
                hcmRef: hcmResult.ref ?? null,
            });
            return this.requestRepo.findOne({ where: { id: request.id } });
        }
        catch (err) {
            if (err.statusCode === 422 || err.statusCode === 400) {
                await this.balanceService.restoreBalance(employeeId, locationId, leaveType, days);
                await this.requestRepo.update(request.id, {
                    status: request_entity_1.RequestStatus.REJECTED,
                });
                throw new common_1.UnprocessableEntityException(`HCM rejected request: ${err.message}`);
            }
            if (err.statusCode === 503 || err.code === 'HCM_UNAVAILABLE') {
                await this.balanceService.restoreBalance(employeeId, locationId, leaveType, days);
                return this.requestRepo.findOne({ where: { id: request.id } });
            }
            await this.balanceService.restoreBalance(employeeId, locationId, leaveType, days);
            await this.requestRepo.update(request.id, {
                status: request_entity_1.RequestStatus.REJECTED,
            });
            throw new common_1.HttpException(`Unexpected error submitting to HCM: ${err.message}`, common_1.HttpStatus.SERVICE_UNAVAILABLE);
        }
    }
    async getRequest(id) {
        const request = await this.requestRepo.findOne({ where: { id } });
        if (!request) {
            throw new common_1.NotFoundException(`Request with id=${id} not found`);
        }
        return request;
    }
    async cancelRequest(id) {
        const request = await this.requestRepo.findOne({ where: { id } });
        if (!request) {
            throw new common_1.NotFoundException(`Request with id=${id} not found`);
        }
        if (request.status !== request_entity_1.RequestStatus.PENDING) {
            throw new common_1.ConflictException(`Cannot cancel request with status=${request.status}. Only PENDING requests can be cancelled.`);
        }
        await this.balanceService.restoreBalance(request.employeeId, request.locationId, request.leaveType, request.days);
        try {
            await this.hcmClient.cancelTimeOff({
                employeeId: request.employeeId,
                locationId: request.locationId,
                leaveType: request.leaveType,
                days: request.days,
                idempotencyKey: `cancel-${request.id}`,
            });
        }
        catch {
        }
        await this.requestRepo.update(id, { status: request_entity_1.RequestStatus.CANCELLED });
        return this.requestRepo.findOne({ where: { id } });
    }
    async listRequests(employeeId) {
        if (employeeId) {
            return this.requestRepo.find({ where: { employeeId }, order: { createdAt: 'DESC' } });
        }
        return this.requestRepo.find({ order: { createdAt: 'DESC' } });
    }
};
exports.RequestService = RequestService;
exports.RequestService = RequestService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(request_entity_1.TimeOffRequest)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        balance_service_1.BalanceService,
        hcm_client_1.HcmClient])
], RequestService);
//# sourceMappingURL=request.service.js.map