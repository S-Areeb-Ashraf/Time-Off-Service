import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
import { spawn } from 'child_process';
import { join } from 'path';

type TestStatus = 'passed' | 'failed';

interface JestAssertionResult {
  title?: string;
  fullName?: string;
  status?: string;
  duration?: number | null;
}

interface JestSuiteResult {
  assertionResults?: JestAssertionResult[];
}

interface JestJsonResult {
  success?: boolean;
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  testResults?: JestSuiteResult[];
}

@Controller('dev')
export class DevController {
  @Get('run-tests')
  async runTests() {
    const rawResult = await this.executeJestJson();
    return this.mapJestResult(rawResult);
  }

  private executeJestJson(): Promise<JestJsonResult> {
    return new Promise((resolve, reject) => {
      const jestCliPath = join(process.cwd(), 'node_modules', 'jest', 'bin', 'jest.js');
      const child = spawn(process.execPath, [jestCliPath, '--json'], {
        cwd: process.cwd(),
        env: process.env,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', () => {
        reject(new InternalServerErrorException('Failed to run jest process'));
      });

      child.on('close', () => {
        try {
          resolve(this.parseJestJson(stdout));
        } catch {
          reject(
            new InternalServerErrorException(
              stderr || 'Unable to parse jest --json output',
            ),
          );
        }
      });
    });
  }

  private parseJestJson(output: string): JestJsonResult {
    const trimmed = output.trim();
    if (!trimmed) {
      throw new Error('Empty jest output');
    }

    try {
      return JSON.parse(trimmed) as JestJsonResult;
    } catch {
      const firstBrace = trimmed.indexOf('{');
      const lastBrace = trimmed.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error('No JSON payload found');
      }

      const jsonCandidate = trimmed.slice(firstBrace, lastBrace + 1);
      return JSON.parse(jsonCandidate) as JestJsonResult;
    }
  }

  private mapJestResult(result: JestJsonResult) {
    const tests = (result.testResults ?? []).flatMap((suite) =>
      (suite.assertionResults ?? []).map((test) => ({
        name: test.fullName ?? test.title ?? 'Unnamed test',
        status: test.status === 'passed' ? 'passed' : 'failed',
        duration: typeof test.duration === 'number' ? test.duration : 0,
      })),
    );

    const failed = typeof result.numFailedTests === 'number'
      ? result.numFailedTests
      : tests.filter((test) => test.status === 'failed').length;

    const passed = typeof result.numPassedTests === 'number'
      ? result.numPassedTests
      : tests.filter((test) => test.status === 'passed').length;

    const total = typeof result.numTotalTests === 'number'
      ? result.numTotalTests
      : tests.length;

    const status: TestStatus = failed > 0 || result.success === false ? 'failed' : 'passed';

    return {
      status,
      total,
      passed,
      failed,
      tests,
    };
  }
}
