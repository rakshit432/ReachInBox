import React from 'react';
import { ArrowLeft, Star, ExternalLink } from 'lucide-react';
import { EmailJob } from '../../types';
import { StatusBadge } from '../ui/Badge';

interface EmailDetailViewProps {
  email: EmailJob;
  onBack: () => void;
}

export const EmailDetailView: React.FC<EmailDetailViewProps> = ({
  email,
  onBack,
}) => {
  const senderInitial = (email.senderEmail[0] || 'S').toUpperCase();
  const displayTime = email.sentAt || email.scheduledAt;

  return (
    <div className="flex-1 bg-white flex flex-col h-full overflow-y-auto">
      {/* Top Bar (Matches Figma Email View Header) */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-gray-900 truncate">
            {email.subject}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={email.status} timestampIso={displayTime} />

          {email.etherealPreviewUrl && (
            <a
              href={email.etherealPreviewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#00A63E] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#008f35]"
            >
              View on Ethereal SMTP
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          <Star className="w-4 h-4 text-gray-300" />
        </div>
      </div>

      {/* Email Metadata & Body */}
      <div className="max-w-4xl w-full mx-auto px-8 py-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00A63E] text-white font-semibold flex items-center justify-center text-sm">
              {senderInitial}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  {email.senderEmail.split('@')[0]}
                </span>
                <span className="text-xs text-gray-400">
                  &lt;{email.senderEmail}&gt;
                </span>
              </div>
              <p className="text-xs text-gray-500">
                to <span className="font-medium">{email.recipientEmail}</span>
              </p>
            </div>
          </div>

          <div className="text-right text-xs text-gray-400">
            {new Date(displayTime).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            })}
          </div>
        </div>

        {/* Email Body Content */}
        <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap border-t border-gray-100 pt-6">
          {email.body}
        </div>

        {email.errorMessage && (
          <div className="mt-6 rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
            <strong>Delivery Error:</strong> {email.errorMessage}
          </div>
        )}
      </div>
    </div>
  );
};

