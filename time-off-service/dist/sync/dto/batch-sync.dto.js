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
exports.RealtimeSyncDto = exports.BatchSyncDto = exports.BatchRecordDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const VALID_LEAVE_TYPES = ['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY'];
class BatchRecordDto {
}
exports.BatchRecordDto = BatchRecordDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BatchRecordDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BatchRecordDto.prototype, "locationId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(VALID_LEAVE_TYPES, {
        message: `leaveType must be one of: ${VALID_LEAVE_TYPES.join(', ')}`,
    }),
    __metadata("design:type", String)
], BatchRecordDto.prototype, "leaveType", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], BatchRecordDto.prototype, "balance", void 0);
class BatchSyncDto {
}
exports.BatchSyncDto = BatchSyncDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => BatchRecordDto),
    __metadata("design:type", Array)
], BatchSyncDto.prototype, "records", void 0);
class RealtimeSyncDto {
}
exports.RealtimeSyncDto = RealtimeSyncDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RealtimeSyncDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RealtimeSyncDto.prototype, "locationId", void 0);
//# sourceMappingURL=batch-sync.dto.js.map