import React from 'react';
import type { TimeOffBalance } from '../api/balance.api';

interface BalanceCardProps {
  balance: TimeOffBalance;
  className?: string;
}

const LEAVE_TYPE_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  ANNUAL: { bg: 'from-brand-500/20 to-brand-600/10', text: 'text-brand-300', icon: '🏖️' },
  SICK: { bg: 'from-amber-500/20 to-amber-600/10', text: 'text-amber-300', icon: '🏥' },
  PERSONAL: { bg: 'from-purple-500/20 to-purple-600/10', text: 'text-purple-300', icon: '👤' },
  MATERNITY: { bg: 'from-pink-500/20 to-pink-600/10', text: 'text-pink-300', icon: '👶' },
};

function getSyncStatus(lastSyncedAt: string): {
  label: string;
  color: string;
  dotColor: string;
} {
  const now = Date.now();
  const synced = new Date(lastSyncedAt).getTime();
  const diffMin = (now - synced) / 60_000;

  if (diffMin < 5) {
    return { label: 'Synced', color: 'text-emerald-400', dotColor: 'bg-emerald-400' };
  }
  if (diffMin < 60) {
    return { label: 'Stale', color: 'text-amber-400', dotColor: 'bg-amber-400 animate-pulse' };
  }
  return {
    label: 'Out of Sync',
    color: 'text-red-400',
    dotColor: 'bg-red-400 animate-pulse',
  };
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function BalanceCard({ balance, className = '' }: BalanceCardProps) {
  const config = LEAVE_TYPE_COLORS[balance.leaveType] ?? LEAVE_TYPE_COLORS.ANNUAL;
  const syncStatus = getSyncStatus(balance.lastSyncedAt);

  return (
    <div
      className={`glass-card p-5 animate-slide-up hover:border-white/20 transition-all duration-300 group ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${config.text}`}>
              {balance.leaveType}
            </p>
            <p className="text-slate-400 text-xs mt-0.5">
              {balance.locationId}
            </p>
          </div>
        </div>

        {/* Sync Status */}
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${syncStatus.dotColor}`} />
          <span className={`text-xs font-medium ${syncStatus.color}`}>
            {syncStatus.label}
          </span>
        </div>
      </div>

      {/* Balance Display */}
      <div
        className={`bg-gradient-to-br ${config.bg} rounded-xl p-4 mb-4 group-hover:scale-[1.01] transition-transform duration-300`}
      >
        <p className="text-slate-400 text-xs mb-1">Available Balance</p>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-white tabular-nums">
            {balance.balance.toFixed(1)}
          </span>
          <span className="text-slate-400 text-sm">days</span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Employee: <span className="text-slate-400 font-medium">{balance.employeeId}</span>
        </span>
        <span title={new Date(balance.lastSyncedAt).toLocaleString()}>
          {formatRelativeTime(balance.lastSyncedAt)}
        </span>
      </div>

      {/* Version Badge */}
      <div className="mt-2 text-right">
        <span className="text-xs text-slate-600">v{balance.version}</span>
      </div>
    </div>
  );
}
