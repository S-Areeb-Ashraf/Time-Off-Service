import React from 'react';
import RequestForm from '../components/RequestForm';

export default function RequestPage() {
  return (
    <div className="page-container">
      {/* Header */}
      <div className="mb-8">
        <h1 className="page-heading">New Time-Off Request</h1>
        <p className="page-subheading">
          Submit a leave request. Balance is verified locally and confirmed with HCM.
        </p>
      </div>

      {/* Info Banner */}
      <div className="glass-card p-4 mb-8 flex items-start gap-3 border-brand-500/20 bg-brand-500/5">
        <span className="text-brand-400 text-lg flex-shrink-0">ℹ️</span>
        <div className="text-sm text-slate-300">
          <p className="font-medium text-brand-300 mb-1">How it works</p>
          <ul className="space-y-1 text-slate-400 text-xs">
            <li>• Your local balance is checked first for instant feedback</li>
            <li>• The request is then sent to HCM for final confirmation</li>
            <li>• If HCM is unreachable, your request stays PENDING until the next sync</li>
            <li>• PENDING requests can be cancelled from the My Requests page</li>
          </ul>
        </div>
      </div>

      {/* Form */}
      <div className="flex justify-start">
        <RequestForm />
      </div>
    </div>
  );
}
