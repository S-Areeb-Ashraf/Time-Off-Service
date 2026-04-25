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
exports.DevController = void 0;
const common_1 = require("@nestjs/common");
const child_process_1 = require("child_process");
const path_1 = require("path");
let DevController = class DevController {
    async runTests() {
        const rawResult = await this.executeJestJson();
        return this.mapJestResult(rawResult);
    }
    executeJestJson() {
        return new Promise((resolve, reject) => {
            const jestCliPath = (0, path_1.join)(process.cwd(), 'node_modules', 'jest', 'bin', 'jest.js');
            const child = (0, child_process_1.spawn)(process.execPath, [jestCliPath, '--json'], {
                cwd: process.cwd(),
                env: process.env,
            });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (chunk) => {
                stdout += chunk.toString();
            });
            child.stderr.on('data', (chunk) => {
                stderr += chunk.toString();
            });
            child.on('error', () => {
                reject(new common_1.InternalServerErrorException('Failed to run jest process'));
            });
            child.on('close', () => {
                try {
                    resolve(this.parseJestJson(stdout));
                }
                catch {
                    reject(new common_1.InternalServerErrorException(stderr || 'Unable to parse jest --json output'));
                }
            });
        });
    }
    parseJestJson(output) {
        const trimmed = output.trim();
        if (!trimmed) {
            throw new Error('Empty jest output');
        }
        try {
            return JSON.parse(trimmed);
        }
        catch {
            const firstBrace = trimmed.indexOf('{');
            const lastBrace = trimmed.lastIndexOf('}');
            if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
                throw new Error('No JSON payload found');
            }
            const jsonCandidate = trimmed.slice(firstBrace, lastBrace + 1);
            return JSON.parse(jsonCandidate);
        }
    }
    mapJestResult(result) {
        const tests = (result.testResults ?? []).flatMap((suite) => (suite.assertionResults ?? []).map((test) => ({
            name: test.fullName ?? test.title ?? 'Unnamed test',
            status: test.status === 'passed' ? 'passed' : 'failed',
            duration: typeof test.duration === 'number' ? test.duration : 0,
        })));
        const failed = typeof result.numFailedTests === 'number'
            ? result.numFailedTests
            : tests.filter((test) => test.status === 'failed').length;
        const passed = typeof result.numPassedTests === 'number'
            ? result.numPassedTests
            : tests.filter((test) => test.status === 'passed').length;
        const total = typeof result.numTotalTests === 'number'
            ? result.numTotalTests
            : tests.length;
        const status = failed > 0 || result.success === false ? 'failed' : 'passed';
        return {
            status,
            total,
            passed,
            failed,
            tests,
        };
    }
};
exports.DevController = DevController;
__decorate([
    (0, common_1.Get)('run-tests'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DevController.prototype, "runTests", null);
exports.DevController = DevController = __decorate([
    (0, common_1.Controller)('dev')
], DevController);
//# sourceMappingURL=dev.controller.js.map