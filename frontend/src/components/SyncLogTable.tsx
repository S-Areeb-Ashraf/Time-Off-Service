import React, { useState } from 'react';
import type { SyncLog } from '../api/sync.api';

interface SyncLogTableProps {
  items: SyncLog[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const TRIGGER_CONFIG: Record<string, { label: string; color: string }> = {
  BATCH: { label: 'Batch', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  REALTIME: { label: 'Realtime', color: 'text-brand-400 bg-brand-400/10 border-brand-400/30' },
  MANUAL: { label: 'Manual', color: 'text-purple-400 bg-purple-400/10 border-purple-400/30' },
};

export default function SyncLogTable({
  items,
  total,
  page,
  limit,
  onPageChange,
  isLoading = false,
}: SyncLogTableProps) {
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="font-semibold text-slate-200">Sync History</h3>
        <span className="text-xs text-slate-500">{total} total entries</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                ID
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Employee
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Location
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Leave Type
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Trigger
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Before
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Delta
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                After
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Time
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <span className="spinner w-5 h-5" />
                    <span>Loading sync log...</span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-slate-500">
                  <div className="text-4xl mb-2">🔄</div>
                  <p>No sync events yet</p>
                </td>
              </tr>
            )}

            {!isLoading &&
              items.map((log) => {
                const triggerConfig = TRIGGER_CONFIG[log.trigger] ?? TRIGGER_CONFIG.BATCH;
                const deltaPositive = log.delta >= 0;

                return (
                  <tr
                    key={log.id}
                    className="border-b border-white/5 hover:bg-white/3 transition-colors"
                  >
                    <td className="px-5 py-3 text-slate-500 font-mono text-xs">
                      #{log.id}
                    </td>
                    <td className="px-5 py-3 text-slate-300 font-mono text-xs">
                      {log.employeeId}
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {log.locationId}
                    </td>
                    <td className="px-5 py-3 text-slate-300 text-xs">
                      {log.leaveType}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${triggerConfig.color}`}
                      >
                        {triggerConfig.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-slate-400 font-mono text-xs">
                      {log.previousBalance.toFixed(1)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs font-semibold">
                      <span
                        className={deltaPositive ? 'text-emerald-400' : 'text-red-400'}
                      >
                        {deltaPositive ? '+' : ''}
                        {log.delta.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-white font-mono text-xs">
                      {log.newBalance.toFixed(1)}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-500 text-xs">
                      {formatDateTime(log.timestamp)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              id="sync-log-prev"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-30"
            >
              ← Prev
            </button>
            <button
              id="sync-log-next"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
