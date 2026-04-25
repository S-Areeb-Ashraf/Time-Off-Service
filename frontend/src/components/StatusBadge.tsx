import React from 'react';
import type { RequestStatus } from '../api/request.api';

interface StatusBadgeProps {
  status: RequestStatus;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<
  RequestStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  PENDING: {
    label: 'Pending',
    bg: 'bg-amber-500/15 border-amber-500/30',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
  },
  APPROVED: {
    label: 'Approved',
    bg: 'bg-emerald-500/15 border-emerald-500/30',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },
  REJECTED: {
    label: 'Rejected',
    bg: 'bg-red-500/15 border-red-500/30',
    text: 'text-red-400',
    dot: 'bg-red-400',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-slate-500/15 border-slate-500/30',
    text: 'text-slate-400',
    dot: 'bg-slate-400',
  },
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${config.bg} ${config.text} ${sizeClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
