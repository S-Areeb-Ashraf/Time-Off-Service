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
exports.BalanceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const balance_entity_1 = require("./balance.entity");
let BalanceService = class BalanceService {
    constructor(balanceRepo) {
        this.balanceRepo = balanceRepo;
    }
    async getBalances(employeeId, locationId) {
        return this.balanceRepo.find({ where: { employeeId, locationId } });
    }
    async getBalance(employeeId, locationId, leaveType) {
        return this.balanceRepo.findOne({
            where: { employeeId, locationId, leaveType },
        });
    }
    async deductBalance(employeeId, locationId, leaveType, days, maxRetries = 3) {
        let attempts = 0;
        while (attempts < maxRetries) {
            attempts++;
            const record = await this.balanceRepo.findOne({
                where: { employeeId, locationId, leaveType },
            });
            if (!record) {
                throw new common_1.NotFoundException(`No balance record found for employee=${employeeId}, location=${locationId}, leaveType=${leaveType}`);
            }
            if (record.balance < days) {
                const err = new Error(`Insufficient balance: available=${record.balance}, requested=${days}`);
                err.code = 'INSUFFICIENT_BALANCE';
                throw err;
            }
            const newBalance = parseFloat((record.balance - days).toFixed(4));
            const result = await this.balanceRepo
                .createQueryBuilder()
                .update(balance_entity_1.TimeOffBalance)
                .set({ balance: newBalance, version: record.version + 1 })
                .where('id = :id AND version = :version', {
                id: record.id,
                version: record.version,
            })
                .execute();
            if (result.affected && result.affected > 0) {
                return { ...record, balance: newBalance, version: record.version + 1 };
            }
            if (attempts >= maxRetries) {
                const conflictErr = new Error('Optimistic locking conflict: too many concurrent writes. Please retry.');
                conflictErr.status = 409;
                throw conflictErr;
            }
            await new Promise((resolve) => setTimeout(resolve, 50 * attempts));
        }
        throw new Error('Unexpected deductBalance loop exit');
    }
    async restoreBalance(employeeId, locationId, leaveType, days) {
        const record = await this.balanceRepo.findOne({
            where: { employeeId, locationId, leaveType },
        });
        if (!record) {
            throw new common_1.NotFoundException(`No balance record found for employee=${employeeId}, location=${locationId}, leaveType=${leaveType}`);
        }
        const newBalance = parseFloat((record.balance + days).toFixed(4));
        await this.balanceRepo.update(record.id, {
            balance: newBalance,
            version: record.version + 1,
        });
        return { ...record, balance: newBalance, version: record.version + 1 };
    }
    async upsertBalance(employeeId, locationId, leaveType, newBalance) {
        let record = await this.balanceRepo.findOne({
            where: { employeeId, locationId, leaveType },
        });
        const previous = record?.balance ?? 0;
        if (!record) {
            record = this.balanceRepo.create({
                employeeId,
                locationId,
                leaveType,
                balance: newBalance,
                lastSyncedAt: new Date(),
                version: 1,
            });
            await this.balanceRepo.save(record);
        }
        else {
            await this.balanceRepo.update(record.id, {
                balance: newBalance,
                lastSyncedAt: new Date(),
                version: record.version + 1,
            });
            record.balance = newBalance;
            record.lastSyncedAt = new Date();
            record.version = record.version + 1;
        }
        const delta = parseFloat((newBalance - previous).toFixed(4));
        return { previous, current: newBalance, delta, record };
    }
};
exports.BalanceService = BalanceService;
exports.BalanceService = BalanceService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(balance_entity_1.TimeOffBalance)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], BalanceService);
//# sourceMappingURL=balance.service.js.map