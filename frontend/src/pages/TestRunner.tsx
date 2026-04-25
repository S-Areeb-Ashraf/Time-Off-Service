import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { runTestSuite, TestRunResult } from '../api/testRunner.api';
import ErrorBanner from '../components/ErrorBanner';

export default function TestRunner() {
  const [result, setResult] = useState<TestRunResult | null>(null);
  const [runError, setRunError] = useState<unknown>(null);

  const runMutation = useMutation({
    mutationFn: () => runTestSuite(),
    onSuccess: (data) => {
      setResult(data);
      setRunError(null);
    },
    onError: (error) => {
      setRunError(error);
      setResult(null);
    },
  });

  return (
    <div className="page-container space-y-6">
      <div>
        <h1 className="page-heading">Test Runner</h1>
        <p className="page-subheading">Run backend jest tests and inspect individual case results</p>
      </div>

      <div className="glass-card p-6">
        <button
          type="button"
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          className="btn-primary flex items-center gap-2"
        >
          {runMutation.isPending ? (
            <>
              <span className="spinner w-4 h-4" />
              Running test suite...
            </>
          ) : (
            'Run Tests'
          )}
        </button>
      </div>

      {runError && <ErrorBanner error={runError} onDismiss={() => setRunError(null)} />}

      {result && (
        <>
          <div className={`glass-card p-4 flex items-center justify-between ${result.failed > 0 ? 'border-red-500/30 bg-red-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
            <p className="text-sm font-medium text-slate-100">
              {result.passed} passed, {result.failed} failed
            </p>
            <p className="text-xs text-slate-300">Total: {result.total}</p>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
              Test Results
            </div>
            <ul className="divide-y divide-white/5">
              {result.tests.map((test, index) => (
                <li key={`${test.name}-${index}`} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className={test.status === 'passed' ? 'text-emerald-400' : 'text-red-400'}>
                      {test.status === 'passed' ? '✅' : '❌'}
                    </span>
                    <p className="text-sm text-slate-200 truncate">{test.name}</p>
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{test.duration} ms</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
