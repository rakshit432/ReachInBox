import React from 'react';
import { Star, ExternalLink, Loader2 } from 'lucide-react';
import { EmailJob } from '../../types';
import { StatusBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';

interface SentEmailsTableProps {
  emails: EmailJob[];
  isLoading: boolean;
  isSearching: boolean;
  onSelectEmail: (email: EmailJob) => void;
}

export const SentEmailsTable: React.FC<SentEmailsTableProps> = ({
  emails,
  isLoading,
  isSearching,
  onSelectEmail,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 gap-2 text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-[#00A63E]" />
        Loading sent emails...
      </div>
    );
  }

  if (emails.length === 0) {
    return <EmptyState type={isSearching ? 'search' : 'sent'} />;
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

          {/* Center: Sent / Failed Status Badge + Subject & Body Snippet */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <StatusBadge status={job.status} timestampIso={job.sentAt} />

            <div className="truncate text-sm">
              <span className="font-semibold text-gray-900">{job.subject}</span>
              <span className="text-gray-400 mx-1.5">-</span>
              <span className="text-gray-500">{job.body}</span>
            </div>
          </div>

          {/* Right: Sent Timestamp, Ethereal Preview Link & Star */}
          <div className="flex items-center gap-3 shrink-0">
            {job.sentAt && (
              <span className="hidden sm:inline-block text-xs text-gray-400">
                {new Date(job.sentAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            )}

            {job.etherealPreviewUrl && (
              <a
                href={job.etherealPreviewUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Open Ethereal Email SMTP Preview"
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-medium text-[#00A63E] hover:bg-emerald-100"
              >
                Ethereal
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            <Star className="w-4 h-4 text-gray-300 hover:text-amber-400" />
          </div>
        </div>
      ))}
    </div>
  );
};

