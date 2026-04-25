import React, { useState, useEffect } from 'react';
import { ApiError } from '../api/apiClient';

interface ErrorBannerProps {
  error: unknown;
  onDismiss?: () => void;
  className?: string;
}

function extractMessage(error: unknown): { message: string; details: string[] } {
  if (error instanceof ApiError) {
    return { message: error.message, details: error.details };
  }
  if (error instanceof Error) {
    return { message: error.message, details: [] };
  }
  if (typeof error === 'string') {
    return { message: error, details: [] };
  }
  return { message: 'An unexpected error occurred', details: [] };
}

export default function ErrorBanner({
  error,
  onDismiss,
  className = '',
}: ErrorBannerProps) {
  const [visible, setVisible] = useState(true);

  // Reset visibility when error changes
  useEffect(() => {
    setVisible(true);
  }, [error]);

  if (!error || !visible) return null;

  const { message, details } = extractMessage(error);

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  return (
    <div
      className={`animate-fade-in flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 ${className}`}
      role="alert"
    >
      {/* Icon */}
      <div className="flex-shrink-0 w-5 h-5 text-red-400 mt-0.5">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-red-300 text-sm font-medium">{message}</p>
        {details.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {details.map((d, i) => (
              <li key={i} className="text-red-400/70 text-xs">
                • {d}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss error"
        className="flex-shrink-0 text-red-400/60 hover:text-red-400 transition-colors"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </div>
  );
}
