import React from 'react';
import { Clock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { EmailStatus } from '../../types';

export interface StatusBadgeProps {
  status: EmailStatus;
  timestampIso?: string | null;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  timestampIso,
}) => {
  const formattedTime = timestampIso
    ? new Date(timestampIso).toLocaleString('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    : '';

  if (status === 'SCHEDULED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF4E5] border border-[#FFD8A8] px-3 py-1 text-xs font-medium text-[#D9480F]">
        <Clock className="w-3.5 h-3.5" />
        {formattedTime || 'Scheduled'}
      </span>
    );
  }

  if (status === 'RATE_LIMITED') {
    return (
      <span
        title="Hourly rate limit reached — automatically rescheduled to next hourly window"
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-xs font-medium text-amber-800"
      >
        <Clock className="w-3.5 h-3.5" />
        Rescheduled ({formattedTime})
      </span>
    );
  }

  if (status === 'PROCESSING') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Sending...
      </span>
    );
  }

  if (status === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-medium text-red-700">
        <AlertTriangle className="w-3.5 h-3.5" />
        Failed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
      <CheckCircle2 className="w-3.5 h-3.5 text-[#00A63E]" />
      Sent
    </span>
  );
};

