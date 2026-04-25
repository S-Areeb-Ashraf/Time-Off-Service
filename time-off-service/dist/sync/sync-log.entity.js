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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncLog = exports.SyncTrigger = void 0;
const typeorm_1 = require("typeorm");
var SyncTrigger;
(function (SyncTrigger) {
    SyncTrigger["BATCH"] = "BATCH";
    SyncTrigger["REALTIME"] = "REALTIME";
    SyncTrigger["MANUAL"] = "MANUAL";
})(SyncTrigger || (exports.SyncTrigger = SyncTrigger = {}));
let SyncLog = class SyncLog {
};
exports.SyncLog = SyncLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], SyncLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], SyncLog.prototype, "employeeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], SyncLog.prototype, "locationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], SyncLog.prototype, "leaveType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], SyncLog.prototype, "trigger", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0 }),
    __metadata("design:type", Number)
], SyncLog.prototype, "delta", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0 }),
    __metadata("design:type", Number)
], SyncLog.prototype, "previousBalance", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0 }),
    __metadata("design:type", Number)
], SyncLog.prototype, "newBalance", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], SyncLog.prototype, "timestamp", void 0);
exports.SyncLog = SyncLog = __decorate([
    (0, typeorm_1.Entity)('sync_log'),
    (0, typeorm_1.Index)(['employeeId', 'locationId']),
    (0, typeorm_1.Index)(['timestamp'])
], SyncLog);
//# sourceMappingURL=sync-log.entity.js.map