import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRequests } from '../api/request.api';
import RequestRow from '../components/RequestRow';
import ErrorBanner from '../components/ErrorBanner';

export default function MyRequests() {
  const [filterEmployee, setFilterEmployee] = useState('EMP001');
  const [appliedFilter, setAppliedFilter] = useState('EMP001');

  const { data: requests, isLoading, error } = useQuery({
    queryKey: ['requests', appliedFilter],
    queryFn: () => fetchRequests(appliedFilter || undefined),
    staleTime: 15_000,
  });

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedFilter(filterEmployee.trim());
  };

  const statusCounts = requests?.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div className="mb-8">
        <h1 className="page-heading">My Requests</h1>
        <p className="page-subheading">Track all submitted leave requests and their current status</p>
      </div>

      {/* Filter Bar */}
      <form
        onSubmit={handleFilter}
        className="glass-card p-4 mb-6 flex flex-wrap gap-3 items-end"
      >
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="requests-empFilter" className="block text-xs font-medium text-slate-400 mb-1.5">
            Filter by Employee ID
          </label>
          <input
            id="requests-empFilter"
            type="text"
            className="input-field"
            placeholder="e.g. EMP001 (empty = all)"
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
          />
        </div>
        <button id="requests-filter-btn" type="submit" className="btn-secondary">
          Filter
        </button>
        {appliedFilter && (
          <button
            type="button"
            onClick={() => {
              setFilterEmployee('');
              setAppliedFilter('');
            }}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear
          </button>
        )}
      </form>

      {/* Summary Stats */}
      {statusCounts && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((status) => {
            const colorMap = {
              PENDING: 'text-amber-400 bg-amber-400/10',
              APPROVED: 'text-emerald-400 bg-emerald-400/10',
              REJECTED: 'text-red-400 bg-red-400/10',
              CANCELLED: 'text-slate-400 bg-slate-400/10',
            };
            return (
              <div
                key={status}
                className={`glass-card p-3 text-center ${colorMap[status]}`}
              >
                <p className="text-2xl font-bold">{statusCounts[status] ?? 0}</p>
                <p className="text-xs mt-0.5 capitalize">{status.toLowerCase()}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Error */}
      {error && <ErrorBanner error={error} className="mb-4" />}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Requests List */}
      {!isLoading && requests && requests.length > 0 && (
        <div className="space-y-3">
          {requests.map((req) => (
            <RequestRow key={req.id} requestItem={req} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && requests && requests.length === 0 && (
        <div className="glass-card p-12 text-center">
          <div className="text-5xl mb-4">📭</div>
          <p className="text-slate-300 font-medium">No requests found</p>
          <p className="text-slate-500 text-sm mt-1">
            {appliedFilter ? `No requests for ${appliedFilter}` : 'Submit a request to get started'}
          </p>
        </div>
      )}
    </div>
  );
}
