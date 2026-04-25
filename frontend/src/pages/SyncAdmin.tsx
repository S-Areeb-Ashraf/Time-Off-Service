import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  triggerRealtimeSync,
  ingestBatch,
  fetchSyncLog,
  BatchRecord,
} from '../api/sync.api';
import SyncLogTable from '../components/SyncLogTable';
import ErrorBanner from '../components/ErrorBanner';

const DEFAULT_BATCH = JSON.stringify(
  {
    records: [
      { employeeId: 'EMP001', locationId: 'LOC_NYC', leaveType: 'ANNUAL', balance: 20 },
      { employeeId: 'EMP001', locationId: 'LOC_NYC', leaveType: 'SICK', balance: 10 },
      { employeeId: 'EMP002', locationId: 'LOC_LA', leaveType: 'ANNUAL', balance: 15 },
    ],
  },
  null,
  2,
);

export default function SyncAdmin() {
  // Realtime sync form
  const [rtEmpId, setRtEmpId] = useState('EMP001');
  const [rtLocId, setRtLocId] = useState('LOC_NYC');
  const [rtResult, setRtResult] = useState<string | null>(null);
  const [rtError, setRtError] = useState<unknown>(null);

  // Batch sync form
  const [batchJson, setBatchJson] = useState(DEFAULT_BATCH);
  const [batchJsonError, setBatchJsonError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<unknown>(null);

  // Sync log pagination + filter
  const [logPage, setLogPage] = useState(1);
  const [logEmpFilter, setLogEmpFilter] = useState('');
  const [appliedEmpFilter, setAppliedEmpFilter] = useState('');

  // Realtime sync mutation
  const realtimeMutation = useMutation({
    mutationFn: () => triggerRealtimeSync(rtEmpId.trim(), rtLocId.trim()),
    onSuccess: (data) => {
      setRtError(null);
      setRtResult(`Synced ${data.synced} balance(s). Deltas: ${data.logs.map((l) => `${l.leaveType} ${l.delta > 0 ? '+' : ''}${l.delta}`).join(', ') || 'none'}`);
    },
    onError: (err) => {
      setRtError(err);
      setRtResult(null);
    },
  });

  // Batch sync mutation
  const batchMutation = useMutation({
    mutationFn: () => {
      let parsed: { records: BatchRecord[] };
      try {
        parsed = JSON.parse(batchJson);
      } catch {
        throw new Error('Invalid JSON — please check your batch payload');
      }
      if (!Array.isArray(parsed.records)) {
        throw new Error('JSON must have a "records" array at the top level');
      }
      return ingestBatch(parsed.records);
    },
    onSuccess: (data) => {
      setBatchError(null);
      setBatchResult(
        `Processed: ${data.processed}, Failed: ${data.failed}${data.failed > 0 ? ` (${data.failedDetails.map((f) => f.reason).join('; ')})` : ''}`,
      );
      setLogPage(1);
    },
    onError: (err) => {
      setBatchError(err);
      setBatchResult(null);
    },
  });

  // Sync log query
  const { data: syncLogData, isLoading: logLoading } = useQuery({
    queryKey: ['syncLog', appliedEmpFilter, logPage],
    queryFn: () => fetchSyncLog(appliedEmpFilter || undefined, logPage, 15),
    staleTime: 10_000,
  });

  return (
    <div className="page-container space-y-8">
      {/* Header */}
      <div>
        <h1 className="page-heading">Sync Admin</h1>
        <p className="page-subheading">
          Trigger HCM synchronization and inspect the sync history
        </p>
      </div>

      {/* Two-column form area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Realtime Sync */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-brand-500/20 rounded-xl flex items-center justify-center text-brand-400 text-lg">
              ⚡
            </div>
            <div>
              <h2 className="font-semibold text-white text-base">Realtime Sync</h2>
              <p className="text-xs text-slate-400">Pull latest balances from HCM now</p>
            </div>
          </div>

          {rtError && (
            <ErrorBanner error={rtError} onDismiss={() => setRtError(null)} className="mb-4" />
          )}

          {rtResult && (
            <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-emerald-400 text-sm animate-fade-in">
              ✓ {rtResult}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label htmlFor="rt-empId" className="block text-xs font-medium text-slate-400 mb-1.5">
                Employee ID
              </label>
              <input
                id="rt-empId"
                type="text"
                className="input-field"
                value={rtEmpId}
                onChange={(e) => { setRtEmpId(e.target.value); setRtResult(null); }}
                placeholder="EMP001"
              />
            </div>
            <div>
              <label htmlFor="rt-locId" className="block text-xs font-medium text-slate-400 mb-1.5">
                Location ID
              </label>
              <input
                id="rt-locId"
                type="text"
                className="input-field"
                value={rtLocId}
                onChange={(e) => { setRtLocId(e.target.value); setRtResult(null); }}
                placeholder="LOC_NYC"
              />
            </div>
            <button
              id="realtime-sync-btn"
              onClick={() => realtimeMutation.mutate()}
              disabled={realtimeMutation.isPending || !rtEmpId || !rtLocId}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {realtimeMutation.isPending ? (
                <>
                  <span className="spinner w-4 h-4" />
                  Syncing...
                </>
              ) : (
                'Trigger Realtime Sync'
              )}
            </button>
          </div>
        </div>

        {/* Batch Sync */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-400 text-lg">
              📦
            </div>
            <div>
              <h2 className="font-semibold text-white text-base">Batch Ingest</h2>
              <p className="text-xs text-slate-400">Import a full HCM snapshot payload</p>
            </div>
          </div>

          {batchError && (
            <ErrorBanner error={batchError} onDismiss={() => setBatchError(null)} className="mb-4" />
          )}

          {batchJsonError && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
              {batchJsonError}
            </div>
          )}

          {batchResult && (
            <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-emerald-400 text-sm animate-fade-in">
              ✓ {batchResult}
            </div>
          )}

          <div>
            <label htmlFor="batch-json" className="block text-xs font-medium text-slate-400 mb-1.5">
              Batch Payload (JSON)
            </label>
            <textarea
              id="batch-json"
              rows={8}
              className="input-field font-mono text-xs resize-y"
              value={batchJson}
              onChange={(e) => {
                setBatchJson(e.target.value);
                setBatchJsonError(null);
                setBatchResult(null);
              }}
              spellCheck={false}
            />
          </div>

          <button
            id="batch-sync-btn"
            onClick={() => batchMutation.mutate()}
            disabled={batchMutation.isPending}
            className="btn-primary w-full flex items-center justify-center gap-2 mt-3"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
          >
            {batchMutation.isPending ? (
              <>
                <span className="spinner w-4 h-4" />
                Processing...
              </>
            ) : (
              'Ingest Batch'
            )}
          </button>
        </div>
      </div>

      {/* Sync Log Table */}
      <div>
        {/* Filter row */}
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="log-emp-filter" className="block text-xs font-medium text-slate-400 mb-1.5">
              Filter Log by Employee ID
            </label>
            <input
              id="log-emp-filter"
              type="text"
              className="input-field"
              placeholder="Leave blank for all employees"
              value={logEmpFilter}
              onChange={(e) => setLogEmpFilter(e.target.value)}
            />
          </div>
          <button
            id="log-filter-btn"
            onClick={() => {
              setAppliedEmpFilter(logEmpFilter.trim());
              setLogPage(1);
            }}
            className="btn-secondary"
          >
            Filter
          </button>
          {appliedEmpFilter && (
            <button
              type="button"
              onClick={() => {
                setLogEmpFilter('');
                setAppliedEmpFilter('');
                setLogPage(1);
              }}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <SyncLogTable
          items={syncLogData?.items ?? []}
          total={syncLogData?.total ?? 0}
          page={logPage}
          limit={15}
          onPageChange={setLogPage}
          isLoading={logLoading}
        />
      </div>
    </div>
  );
}
