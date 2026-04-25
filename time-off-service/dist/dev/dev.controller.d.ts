type TestStatus = 'passed' | 'failed';
export declare class DevController {
    runTests(): Promise<{
        status: TestStatus;
        total: number;
        passed: number;
        failed: number;
        tests: {
            name: string;
            status: string;
            duration: number;
        }[];
    }>;
    private executeJestJson;
    private parseJestJson;
    private mapJestResult;
}
export {};
