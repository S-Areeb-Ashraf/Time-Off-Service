import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRequest } from '../api/request.api';
import { fetchBalances } from '../api/balance.api';
import ErrorBanner from './ErrorBanner';

interface RequestFormProps {
  defaultEmployeeId?: string;
  defaultLocationId?: string;
}

const LEAVE_TYPES = ['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY'];

interface FormValues {
  employeeId: string;
  locationId: string;
  leaveType: string;
  days: string;
}

interface FormErrors {
  employeeId?: string;
  locationId?: string;
  leaveType?: string;
  days?: string;
}

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.employeeId.trim()) errors.employeeId = 'Employee ID is required';
  if (!values.locationId.trim()) errors.locationId = 'Location ID is required';
  if (!values.leaveType) errors.leaveType = 'Leave type is required';
  const daysNum = parseFloat(values.days);
  if (!values.days || isNaN(daysNum)) errors.days = 'Days is required';
  else if (daysNum < 0.5) errors.days = 'Minimum is 0.5 days';
  else if (daysNum > 365) errors.days = 'Maximum is 365 days';
  return errors;
}

export default function RequestForm({
  defaultEmployeeId = 'EMP001',
  defaultLocationId = 'LOC_NYC',
}: RequestFormProps) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<FormValues>({
    employeeId: defaultEmployeeId,
    locationId: defaultLocationId,
    leaveType: 'ANNUAL',
    days: '',
  });
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const errors = validate(values);
  const isFormValid = Object.keys(errors).length === 0;

  // Live balance lookup
  const { data: balances } = useQuery({
    queryKey: ['balances', values.employeeId, values.locationId],
    queryFn: () => fetchBalances(values.employeeId, values.locationId),
    enabled: !!(values.employeeId && values.locationId),
    staleTime: 30_000,
  });

  const currentBalance =
    balances?.find((b) => b.leaveType === values.leaveType)?.balance ?? null;

  const daysNum = parseFloat(values.days) || 0;
  const remainingAfter =
    currentBalance !== null ? currentBalance - daysNum : null;
  const isOverBalance = currentBalance !== null && daysNum > currentBalance;

  const submitMutation = useMutation({
    mutationFn: () =>
      createRequest({
        employeeId: values.employeeId,
        locationId: values.locationId,
        leaveType: values.leaveType,
        days: parseFloat(values.days),
      }),
    onSuccess: (result) => {
      setSubmitError(null);
      setSuccessMsg(
        `Request #${result.id} submitted — status: ${result.status}`,
      );
      setValues((v) => ({ ...v, days: '' }));
      setTouched({});
      // Optimistic UI: refetch balances immediately
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: (err) => {
      setSubmitError(err);
      setSuccessMsg(null);
    },
  });

  const handleChange =
    (field: keyof FormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setValues((v) => ({ ...v, [field]: e.target.value }));
      setSuccessMsg(null);
    };

  const handleBlur = (field: keyof FormValues) => () => {
    setTouched((t) => ({ ...t, [field]: true }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mark all touched
    setTouched({ employeeId: true, locationId: true, leaveType: true, days: true });
    if (!isFormValid || isOverBalance) return;
    submitMutation.mutate();
  };

  const showError = (field: keyof FormValues) =>
    touched[field] && errors[field];

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-card p-6 max-w-xl w-full space-y-5"
      noValidate
    >
      <h2 className="text-xl font-semibold text-white mb-1">Submit Time-Off Request</h2>
      <p className="text-slate-400 text-sm mb-4">
        Requests are submitted to HCM for confirmation.
      </p>

      {submitError && (
        <ErrorBanner error={submitError} onDismiss={() => setSubmitError(null)} />
      )}

      {successMsg && (
        <div className="animate-fade-in bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-emerald-400 text-sm">
          ✓ {successMsg}
        </div>
      )}

      {/* Employee ID */}
      <div>
        <label htmlFor="req-employeeId" className="block text-sm font-medium text-slate-300 mb-1.5">
          Employee ID
        </label>
        <input
          id="req-employeeId"
          type="text"
          className={`input-field ${showError('employeeId') ? 'input-error' : ''}`}
          placeholder="e.g. EMP001"
          value={values.employeeId}
          onChange={handleChange('employeeId')}
          onBlur={handleBlur('employeeId')}
        />
        {showError('employeeId') && (
          <p className="mt-1 text-xs text-red-400">{errors.employeeId}</p>
        )}
      </div>

      {/* Location ID */}
      <div>
        <label htmlFor="req-locationId" className="block text-sm font-medium text-slate-300 mb-1.5">
          Location ID
        </label>
        <input
          id="req-locationId"
          type="text"
          className={`input-field ${showError('locationId') ? 'input-error' : ''}`}
          placeholder="e.g. LOC_NYC"
          value={values.locationId}
          onChange={handleChange('locationId')}
          onBlur={handleBlur('locationId')}
        />
        {showError('locationId') && (
          <p className="mt-1 text-xs text-red-400">{errors.locationId}</p>
        )}
      </div>

      {/* Leave Type */}
      <div>
        <label htmlFor="req-leaveType" className="block text-sm font-medium text-slate-300 mb-1.5">
          Leave Type
        </label>
        <select
          id="req-leaveType"
          className={`input-field ${showError('leaveType') ? 'input-error' : ''}`}
          value={values.leaveType}
          onChange={handleChange('leaveType')}
          onBlur={handleBlur('leaveType')}
        >
          {LEAVE_TYPES.map((lt) => (
            <option key={lt} value={lt} className="bg-slate-900">
              {lt}
            </option>
          ))}
        </select>
        {showError('leaveType') && (
          <p className="mt-1 text-xs text-red-400">{errors.leaveType}</p>
        )}
      </div>

      {/* Days */}
      <div>
        <label htmlFor="req-days" className="block text-sm font-medium text-slate-300 mb-1.5">
          Number of Days
        </label>
        <input
          id="req-days"
          type="number"
          step="0.5"
          min="0.5"
          className={`input-field ${
            showError('days') || isOverBalance ? 'input-error' : ''
          }`}
          placeholder="e.g. 3"
          value={values.days}
          onChange={handleChange('days')}
          onBlur={handleBlur('days')}
        />
        {showError('days') && (
          <p className="mt-1 text-xs text-red-400">{errors.days}</p>
        )}
        {isOverBalance && !errors.days && (
          <p className="mt-1 text-xs text-red-400">
            Exceeds available balance ({currentBalance} days)
          </p>
        )}
      </div>

      {/* Live Balance Preview */}
      {values.employeeId && values.locationId && (
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Balance Preview
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Current balance</span>
            <span className="text-sm font-mono text-white">
              {currentBalance !== null ? `${currentBalance.toFixed(1)} days` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">After request</span>
            <span
              className={`text-sm font-mono font-semibold ${
                remainingAfter !== null && remainingAfter < 0
                  ? 'text-red-400'
                  : remainingAfter !== null && remainingAfter <= 2
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {remainingAfter !== null
                ? `${remainingAfter.toFixed(1)} days`
                : '—'}
            </span>
          </div>
          {remainingAfter !== null && remainingAfter >= 0 && (
            <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{
                  width: currentBalance
                    ? `${Math.max(0, (remainingAfter / currentBalance) * 100)}%`
                    : '0%',
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      <button
        id="submit-request-btn"
        type="submit"
        disabled={
          submitMutation.isPending ||
          isOverBalance ||
          (!isFormValid && Object.keys(touched).length > 0)
        }
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {submitMutation.isPending ? (
          <>
            <span className="spinner w-4 h-4" />
            Submitting...
          </>
        ) : (
          'Submit Request'
        )}
      </button>
    </form>
  );
}
