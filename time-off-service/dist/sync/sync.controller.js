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
exports.SyncController = void 0;
const common_1 = require("@nestjs/common");
const sync_service_1 = require("./sync.service");
const batch_sync_dto_1 = require("./dto/batch-sync.dto");
const sync_log_entity_1 = require("./sync-log.entity");
let SyncController = class SyncController {
    constructor(syncService) {
        this.syncService = syncService;
    }
    async syncRealtime(dto) {
        return this.syncService.syncRealtime(dto.employeeId, dto.locationId, sync_log_entity_1.SyncTrigger.MANUAL);
    }
    async ingestBatch(dto) {
        return this.syncService.ingestBatch(dto.records);
    }
    async getSyncLog(employeeId, page, limit) {
        return this.syncService.getSyncLog(employeeId, page ? Number(page) : 1, limit ? Number(limit) : 20);
    }
};
exports.SyncController = SyncController;
__decorate([
    (0, common_1.Post)('realtime'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [batch_sync_dto_1.RealtimeSyncDto]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "syncRealtime", null);
__decorate([
    (0, common_1.Post)('batch'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [batch_sync_dto_1.BatchSyncDto]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "ingestBatch", null);
__decorate([
    (0, common_1.Get)('log'),
    __param(0, (0, common_1.Query)('employeeId')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "getSyncLog", null);
exports.SyncController = SyncController = __decorate([
    (0, common_1.Controller)('time-off/sync'),
    __metadata("design:paramtypes", [sync_service_1.SyncService])
], SyncController);
//# sourceMappingURL=sync.controller.js.map