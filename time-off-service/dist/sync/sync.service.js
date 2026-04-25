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
exports.SyncService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const sync_log_entity_1 = require("./sync-log.entity");
const balance_service_1 = require("../balance/balance.service");
const hcm_client_1 = require("../hcm/hcm.client");
let SyncService = class SyncService {
    constructor(syncLogRepo, balanceService, hcmClient) {
        this.syncLogRepo = syncLogRepo;
        this.balanceService = balanceService;
        this.hcmClient = hcmClient;
    }
    async ingestBatch(records) {
        const logs = [];
        const failedDetails = [];
        for (const record of records) {
            try {
                const { previous, current, delta } = await this.balanceService.upsertBalance(record.employeeId, record.locationId, record.leaveType, record.balance);
                await this.syncLogRepo.save(this.syncLogRepo.create({
                    employeeId: record.employeeId,
                    locationId: record.locationId,
                    leaveType: record.leaveType,
                    trigger: sync_log_entity_1.SyncTrigger.BATCH,
                    delta,
                    previousBalance: previous,
                    newBalance: current,
                }));
                logs.push({
                    employeeId: record.employeeId,
                    locationId: record.locationId,
                    leaveType: record.leaveType,
                    previous,
                    current,
                    delta,
                });
            }
            catch (err) {
                failedDetails.push({ record, reason: err.message });
            }
        }
        return {
            processed: logs.length,
            failed: failedDetails.length,
            failedDetails,
            logs,
        };
    }
    async syncRealtime(employeeId, locationId, trigger = sync_log_entity_1.SyncTrigger.REALTIME) {
        const hcmBalances = await this.hcmClient.getBalances(employeeId, locationId);
        const logs = [];
        for (const hcmBalance of hcmBalances) {
            const { previous, current, delta } = await this.balanceService.upsertBalance(employeeId, locationId, hcmBalance.leaveType, hcmBalance.balance);
            await this.syncLogRepo.save(this.syncLogRepo.create({
                employeeId,
                locationId,
                leaveType: hcmBalance.leaveType,
                trigger,
                delta,
                previousBalance: previous,
                newBalance: current,
            }));
            logs.push({
                employeeId,
                locationId,
                leaveType: hcmBalance.leaveType,
                previous,
                current,
                delta,
            });
        }
        return { synced: logs.length, logs };
    }
    async getSyncLog(employeeId, page = 1, limit = 20) {
        const where = employeeId ? { employeeId } : {};
        const [items, total] = await this.syncLogRepo.findAndCount({
            where,
            order: { timestamp: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
        return { items, total, page, limit };
    }
};
exports.SyncService = SyncService;
exports.SyncService = SyncService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(sync_log_entity_1.SyncLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        balance_service_1.BalanceService,
        hcm_client_1.HcmClient])
], SyncService);
//# sourceMappingURL=sync.service.js.map