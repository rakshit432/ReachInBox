import React from 'react';
import { Star, Loader2 } from 'lucide-react';
import { EmailJob } from '../../types';
import { StatusBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';

interface ScheduledEmailsTableProps {
  emails: EmailJob[];
  isLoading: boolean;
  isSearching: boolean;
  onSelectEmail: (email: EmailJob) => void;
  onComposeClick: () => void;
}

export const ScheduledEmailsTable: React.FC<ScheduledEmailsTableProps> = ({
  emails,
  isLoading,
  isSearching,
  onSelectEmail,
  onComposeClick,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 gap-2 text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-[#00A63E]" />
        Loading scheduled emails...
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <EmptyState
        type={isSearching ? 'search' : 'scheduled'}
        onActionClick={onComposeClick}
      />
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {emails.map((job) => (
        <div
          key={job.id}
          onClick={() => onSelectEmail(job)}
          className="flex items-center justify-between gap-4 px-6 py-3.5 hover:bg-gray-50/80 transition-colors cursor-pointer"
        >
          {/* Left: Recipient Email */}
          <div className="w-56 shrink-0 truncate text-sm font-medium text-gray-900">
            To: {job.recipientEmail}
          </div>

          {/* Center: Scheduled Time Badge + Subject & Body Snippet (Matches Figma Row) */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <StatusBadge status={job.status} timestampIso={job.scheduledAt} />

            <div className="truncate text-sm">
              <span className="font-semibold text-gray-900">{job.subject}</span>
              <span className="text-gray-400 mx-1.5">-</span>
              <span className="text-gray-500">{job.body}</span>
            </div>
          </div>

          {/* Right: Sender tag & Star Icon */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline-block text-[11px] text-gray-400">
              via {job.senderEmail}
            </span>
            <Star className="w-4 h-4 text-gray-300 hover:text-amber-400" />
          </div>
        </div>
      ))}
    </div>
  );
};

