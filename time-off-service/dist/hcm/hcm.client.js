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
exports.HcmClient = exports.HcmError = void 0;
const common_1 = require("@nestjs/common");
class HcmError extends Error {
    constructor(statusCode, message, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'HcmError';
    }
}
exports.HcmError = HcmError;
let HcmClient = class HcmClient {
    constructor() {
        this.maxRetries = 3;
        this.timeoutMs = 10_000;
        this.baseUrl = process.env.MOCK_HCM_URL ?? 'http://localhost:3001';
    }
    async getBalances(employeeId, locationId) {
        const url = `${this.baseUrl}/hcm/balance?employeeId=${encodeURIComponent(employeeId)}&locationId=${encodeURIComponent(locationId)}`;
        const response = await this.fetchWithRetry(url, { method: 'GET' });
        return response;
    }
    async submitTimeOff(payload) {
        const url = `${this.baseUrl}/hcm/time-off`;
        const response = await this.fetchWithRetry(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Idempotency-Key': payload.idempotencyKey,
            },
            body: JSON.stringify({
                employeeId: payload.employeeId,
                locationId: payload.locationId,
                leaveType: payload.leaveType,
                days: payload.days,
            }),
        });
        return response;
    }
    async cancelTimeOff(payload) {
        const url = `${this.baseUrl}/hcm/time-off/cancel`;
        try {
            await this.fetchWithRetry(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': payload.idempotencyKey,
                },
                body: JSON.stringify({
                    employeeId: payload.employeeId,
                    locationId: payload.locationId,
                    leaveType: payload.leaveType,
                    days: payload.days,
                }),
            });
        }
        catch {
        }
    }
    async submitBatch(records) {
        const url = `${this.baseUrl}/hcm/batch`;
        await this.fetchWithRetry(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records }),
        });
    }
    async fetchWithRetry(url, options, attempt = 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
        let response;
        try {
            response = await fetch(url, { ...options, signal: controller.signal });
        }
        catch (err) {
            clearTimeout(timeoutId);
            const isAborted = err.name === 'AbortError';
            const isNetworkError = err.code === 'ECONNREFUSED' ||
                err.code === 'ETIMEDOUT' ||
                err.message?.includes('fetch failed');
            if ((isAborted || isNetworkError) && attempt < this.maxRetries) {
                await this.sleep(500 * attempt);
                return this.fetchWithRetry(url, options, attempt + 1);
            }
            const hcmErr = new HcmError(503, `HCM unreachable: ${err.message}`, 'HCM_UNAVAILABLE');
            hcmErr.statusCode = 503;
            throw hcmErr;
        }
        finally {
            clearTimeout(timeoutId);
        }
        if (response.status >= 400 && response.status < 500) {
            let body = {};
            try {
                body = await response.json();
            }
            catch {
            }
            throw new HcmError(response.status, body.message ?? `HCM responded with ${response.status}`, body.code);
        }
        if (response.status >= 500) {
            if (attempt < this.maxRetries) {
                await this.sleep(500 * attempt);
                return this.fetchWithRetry(url, options, attempt + 1);
            }
            throw new HcmError(503, `HCM service unavailable after ${this.maxRetries} attempts`, 'HCM_UNAVAILABLE');
        }
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return response.json();
        }
        return {};
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.HcmClient = HcmClient;
exports.HcmClient = HcmClient = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], HcmClient);
//# sourceMappingURL=hcm.client.js.map