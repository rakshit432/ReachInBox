import React from 'react';
import { Mail, Clock, Send } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  type: 'scheduled' | 'sent' | 'search';
  onActionClick?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  onActionClick,
}) => {
  const Icon =
    type === 'scheduled' ? Clock : type === 'sent' ? Send : Mail;

  const title =
    type === 'scheduled'
      ? 'No scheduled emails yet'
      : type === 'sent'
      ? 'No sent emails yet'
      : 'No matching emails found';

  const description =
    type === 'scheduled'
      ? 'Schedule a single email or upload a CSV list of leads to queue delayed emails via BullMQ.'
      : type === 'sent'
      ? 'Once your scheduled emails reach their target send time, they will appear here with their Ethereal preview link.'
      : 'Try adjusting your Elasticsearch query or clearing the search filter.';

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#00A63E] mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-md mb-5">{description}</p>
      {type === 'scheduled' && onActionClick && (
        <Button variant="outline-green" onClick={onActionClick}>
          Compose New Email
        </Button>
      )}
    </div>
  );
};

