import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TimeOffRequest } from '../api/request.api';
import { cancelRequest } from '../api/request.api';
import StatusBadge from './StatusBadge';
import ErrorBanner from './ErrorBanner';

interface RequestRowProps {
  requestItem: TimeOffRequest;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function RequestRow({ requestItem }: RequestRowProps) {
  const queryClient = useQueryClient();
  const [cancelError, setCancelError] = useState<unknown>(null);

  const cancelMutation = useMutation({
    mutationFn: () => cancelRequest(requestItem.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['balances'] });
    },
    onError: (err) => {
      setCancelError(err);
    },
  });

  return (
    <div className="glass-card p-4 animate-fade-in hover:border-white/20 transition-all duration-200">
      {cancelError && (
        <div className="mb-3">
          <ErrorBanner error={cancelError} onDismiss={() => setCancelError(null)} />
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Left: Info */}
        <div className="flex items-center gap-4 min-w-0">
          {/* ID Badge */}
          <div className="flex-shrink-0 w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center text-slate-400 text-sm font-mono">
            #{requestItem.id}
          </div>

          {/* Details */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-medium text-sm">
                {requestItem.leaveType}
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-slate-300 text-sm">
                {requestItem.days} {requestItem.days === 1 ? 'day' : 'days'}
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-slate-400 text-xs">{requestItem.locationId}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-slate-500 text-xs">
                Submitted {formatDate(requestItem.createdAt)}
              </span>
              {requestItem.hcmRef && (
                <>
                  <span className="text-slate-600 text-xs">•</span>
                  <span className="text-slate-600 text-xs font-mono">
                    {requestItem.hcmRef}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Status + Actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <StatusBadge status={requestItem.status} />

          {requestItem.status === 'PENDING' && (
            <button
              id={`cancel-request-${requestItem.id}`}
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="btn-danger flex items-center gap-1.5"
            >
              {cancelMutation.isPending ? (
                <>
                  <span className="spinner w-3 h-3" />
                  <span>Cancelling...</span>
                </>
              ) : (
                'Cancel'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
