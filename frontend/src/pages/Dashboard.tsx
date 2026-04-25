import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchBalances } from '../api/balance.api';
import BalanceCard from '../components/BalanceCard';
import ErrorBanner from '../components/ErrorBanner';

const PRESET_EMPLOYEES = [
  { employeeId: 'EMP001', locationId: 'LOC_NYC' },
  { employeeId: 'EMP002', locationId: 'LOC_LA' },
  { employeeId: 'EMP003', locationId: 'LOC_CHI' },
];

export default function Dashboard() {
  const [employeeId, setEmployeeId] = useState('EMP001');
  const [locationId, setLocationId] = useState('LOC_NYC');
  const [inputEmp, setInputEmp] = useState('EMP001');
  const [inputLoc, setInputLoc] = useState('LOC_NYC');

  const {
    data: balances,
    isLoading,
    error,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['balances', employeeId, locationId],
    queryFn: () => fetchBalances(employeeId, locationId),
    staleTime: 30_000,
    refetchInterval: 30_000,
    enabled: !!(employeeId && locationId),
  });

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setEmployeeId(inputEmp.trim());
    setLocationId(inputLoc.trim());
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="mb-8">
        <h1 className="page-heading">Dashboard</h1>
        <p className="page-subheading">
          Employee leave balances — auto-refreshes every 30 seconds
          {dataUpdatedAt ? (
            <span className="ml-2 text-slate-600">
              · Last updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          ) : null}
        </p>
      </div>

      {/* Quick-select presets */}
      <div className="flex flex-wrap gap-2 mb-6">
        {PRESET_EMPLOYEES.map((emp) => (
          <button
            key={emp.employeeId}
            onClick={() => {
              setEmployeeId(emp.employeeId);
              setLocationId(emp.locationId);
              setInputEmp(emp.employeeId);
              setInputLoc(emp.locationId);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 ${
              employeeId === emp.employeeId && locationId === emp.locationId
                ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
            }`}
          >
            {emp.employeeId} · {emp.locationId}
          </button>
        ))}
      </div>

      {/* Custom Lookup */}
      <form onSubmit={handleLookup} className="glass-card p-5 mb-8 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="dash-employeeId" className="block text-xs font-medium text-slate-400 mb-1.5">
            Employee ID
          </label>
          <input
            id="dash-employeeId"
            type="text"
            className="input-field"
            placeholder="EMP001"
            value={inputEmp}
            onChange={(e) => setInputEmp(e.target.value)}
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="dash-locationId" className="block text-xs font-medium text-slate-400 mb-1.5">
            Location ID
          </label>
          <input
            id="dash-locationId"
            type="text"
            className="input-field"
            placeholder="LOC_NYC"
            value={inputLoc}
            onChange={(e) => setInputLoc(e.target.value)}
          />
        </div>
        <button id="dash-lookup-btn" type="submit" className="btn-secondary">
          Look Up
        </button>
      </form>

      {/* Error */}
      {error && <ErrorBanner error={error} className="mb-6" />}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-44 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Balance Cards */}
      {!isLoading && balances && balances.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {balances.map((balance) => (
            <BalanceCard key={balance.id} balance={balance} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && balances && balances.length === 0 && !error && (
        <div className="glass-card p-12 text-center">
          <div className="text-5xl mb-4">📭</div>
          <p className="text-slate-300 font-medium">No balances found</p>
          <p className="text-slate-500 text-sm mt-1">
            Run a sync to populate balances for {employeeId} at {locationId}
          </p>
        </div>
      )}
    </div>
  );
}
