import { apiClient } from './apiClient';

export type TestStatus = 'passed' | 'failed';

export interface TestCaseResult {
  name: string;
  status: TestStatus;
  duration: number;
}

export interface TestRunResult {
  status: TestStatus;
  total: number;
  passed: number;
  failed: number;
  tests: TestCaseResult[];
}

export function runTestSuite(): Promise<TestRunResult> {
  return apiClient.get<TestRunResult>('/dev/run-tests');
}
