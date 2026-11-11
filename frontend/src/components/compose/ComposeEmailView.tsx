import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  Upload,
  Clock,
  Paperclip,
  Plus,
  X,
  Bold,
  Italic,
  Underline,
  List,
  AlignLeft,
  Link2,
} from 'lucide-react';
import { SenderAccount } from '../../types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { extractEmailsFromText } from './csvLeadParser';

interface ComposeEmailViewProps {
  senders: SenderAccount[];
  onCreateNewSender: () => Promise<void>;
  onScheduleSubmit: (data: {
    senderId: string;
    recipients: string[];
    subject: string;
    body: string;
    startTime: string;
    delayBetweenEmailsSeconds: number;
    hourlyLimit: number;
  }) => Promise<void>;
  onCancel: () => void;
}

export const ComposeEmailView: React.FC<ComposeEmailViewProps> = ({
  senders,
  onCreateNewSender,
  onScheduleSubmit,
  onCancel,
}) => {
  const [selectedSenderId, setSelectedSenderId] = useState<string>(
    senders[0]?.id || ''
  );
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delaySeconds, setDelaySeconds] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(
    senders[0]?.hourlyLimit || 50
  );

  const toLocalDateTimeInput = (date: Date): string => {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 19);
  };

  // Default start time: empty (Send Immediately) until user picks a Send Later time
  const [startTimeIso, setStartTimeIso] = useState<string>('');
  const [selectedPresetLabel, setSelectedPresetLabel] = useState<string | null>(
    null
  );

  const [showSendLaterPopover, setShowSendLaterPopover] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingSender, setIsCreatingSender] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Add manual email address when user presses Enter, Space, or Comma
  const handleAddRecipientFromInput = () => {
    const extracted = extractEmailsFromText(recipientInput);
    if (extracted.length > 0) {
      setRecipients((prev) => Array.from(new Set([...prev, ...extracted])));
      setRecipientInput('');
    }
  };

  // Parse uploaded .csv or .txt file of email leads
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const detectedEmails = extractEmailsFromText(text);
    setUploadedFileName(file.name);
    setRecipients((prev) => Array.from(new Set([...prev, ...detectedEmails])));
    e.target.value = '';
  };

  const removeRecipient = (emailToRemove: string) => {
    setRecipients((prev) => prev.filter((item) => item !== emailToRemove));
  };

  const [presetOffsetMs, setPresetOffsetMs] = useState<number | null>(null);

  const applyQuickTimePreset = (offsetMs: number, label: string) => {
    const target = new Date(Date.now() + offsetMs);
    setStartTimeIso(toLocalDateTimeInput(target));
    setPresetOffsetMs(offsetMs);
    setSelectedPresetLabel(label);
  };

  const handleSubmit = async (overrideStartTimeIso?: string) => {
    setFormError(null);
    setShowSendLaterPopover(false);

    // Include any typed email still sitting in the text box
    const pendingFromInput = extractEmailsFromText(recipientInput);
    const finalRecipients = Array.from(
      new Set([...recipients, ...pendingFromInput])
    );

    if (finalRecipients.length === 0) {
      setFormError(
        'Please enter at least one recipient email or upload a CSV/TXT file.'
      );
      return;
    }
    if (!subject.trim()) {
      setFormError('Please enter an email subject.');
      return;
    }
    if (!body.trim()) {
      setFormError('Please enter an email body.');
      return;
    }

    setIsSubmitting(true);
    try {
      let targetStartDate: string;
      if (overrideStartTimeIso) {
        targetStartDate = new Date(overrideStartTimeIso).toISOString();
      } else if (presetOffsetMs !== null) {
        targetStartDate = new Date(Date.now() + presetOffsetMs).toISOString();
      } else if (startTimeIso) {
        targetStartDate = new Date(startTimeIso).toISOString();
      } else {
        targetStartDate = new Date().toISOString();
      }

      await onScheduleSubmit({
        senderId: selectedSenderId || senders[0]?.id,
        recipients: finalRecipients,
        subject: subject.trim(),
        body: body.trim(),
        startTime: targetStartDate,
        delayBetweenEmailsSeconds: Math.max(0, Number(delaySeconds) || 0),
        hourlyLimit: Math.max(1, Number(hourlyLimit) || 50),
      });
    } catch (err) {
      setFormError((err as Error).message || 'Failed to schedule emails');
    } finally {
      setIsSubmitting(false);
    }
  };

  const visibleChips = recipients.slice(0, 3);
  const remainingCount = Math.max(0, recipients.length - visibleChips.length);

  return (
    <div className="flex-1 bg-white flex flex-col h-full overflow-y-auto">
      {/* Top Action Header (Matches Figma "Compose New Email") */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">
            Compose New Email
          </h1>
        </div>

        <div className="flex items-center gap-3 relative">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Upload CSV / TXT lead list"
            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 cursor-pointer"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowSendLaterPopover((prev) => !prev)}
            title="Set Start Time (Send Later)"
            className={`p-2 rounded-full cursor-pointer transition-colors ${
              showSendLaterPopover
                ? 'bg-emerald-50 text-[#00A63E]'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Clock className="w-4 h-4" />
          </button>

          <Button
            variant="outline-green"
            onClick={() => setShowSendLaterPopover((prev) => !prev)}
          >
            {selectedPresetLabel
              ? `Send Later (${selectedPresetLabel})`
              : startTimeIso
              ? `Send Later (${new Date(startTimeIso).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })})`
              : 'Send Later'}
          </Button>

          <Button
            variant="primary"
            onClick={() => handleSubmit()}
            isLoading={isSubmitting}
          >
            {startTimeIso || presetOffsetMs
              ? `Schedule (${recipients.length || 0})`
              : `Send (${recipients.length || 0})`}
          </Button>

          {/* Send Later Modal (Uses Reusable Modal Component) */}
          <Modal
            isOpen={showSendLaterPopover}
            onClose={() => setShowSendLaterPopover(false)}
            title="Send Later"
            maxWidthClass="max-w-sm"
          >
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                Pick date & time (with seconds)
              </label>
              <input
                type="datetime-local"
                step="1"
                value={startTimeIso}
                onChange={(e) => {
                  setStartTimeIso(e.target.value);
                  setPresetOffsetMs(null);
                  setSelectedPresetLabel(null);
                }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 mb-3 focus:border-[#00A63E] focus:outline-none"
              />

              <div className="space-y-1 border-t border-gray-100 pt-2 mb-4 text-xs">
                {[
                  {
                    offset: 15 * 1000,
                    label: 'In 15 sec',
                    desc: 'In 15 seconds (Quick Demo Test)',
                  },
                  {
                    offset: 60 * 1000,
                    label: 'In 1 min',
                    desc: 'In 1 minute (Server Restart Demo)',
                  },
                  {
                    offset: 2 * 60 * 1000,
                    label: 'In 2 min',
                    desc: 'In 2 minutes',
                  },
                  {
                    offset: 3600 * 1000,
                    label: 'In 1 hr',
                    desc: 'In 1 hour',
                  },
                  {
                    offset: 24 * 3600 * 1000,
                    label: 'Tomorrow',
                    desc: 'Tomorrow, same time',
                  },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      applyQuickTimePreset(preset.offset, preset.label)
                    }
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center justify-between ${
                      selectedPresetLabel === preset.label
                        ? 'bg-emerald-50 text-[#00A63E] font-semibold border border-[#00A63E]/30'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span>{preset.desc}</span>
                    {selectedPresetLabel === preset.label && (
                      <span className="text-[11px] text-[#00A63E]">✓</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setStartTimeIso('');
                    setPresetOffsetMs(null);
                    setSelectedPresetLabel(null);
                    setShowSendLaterPopover(false);
                  }}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  isLoading={isSubmitting}
                  onClick={() => {
                    const pendingFromInput =
                      extractEmailsFromText(recipientInput);
                    const hasRecipients =
                      recipients.length > 0 || pendingFromInput.length > 0;
                    if (hasRecipients && subject.trim() && body.trim()) {
                      handleSubmit();
                    } else {
                      setShowSendLaterPopover(false);
                    }
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      </div>

      {/* Main Compose Form Body */}
      <div className="max-w-5xl w-full mx-auto px-8 py-6 flex-1 flex flex-col">
        {formError && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs font-medium text-red-700">
            {formError}
          </div>
        )}

        {/* From (Multi-Sender Ethereal Account Selector) */}
        <div className="flex items-center gap-4 py-3 border-b border-gray-100">
          <span className="w-16 text-sm text-gray-500">From</span>
          <select
            value={selectedSenderId}
            onChange={(e) => setSelectedSenderId(e.target.value)}
            className="rounded-lg bg-gray-100/80 border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-800 focus:outline-none focus:border-[#00A63E]"
          >
            {senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.email} ({s.name})
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={isCreatingSender}
            onClick={async () => {
              setIsCreatingSender(true);
              try {
                await onCreateNewSender();
              } finally {
                setIsCreatingSender(false);
              }
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#00A63E] hover:underline cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {isCreatingSender ? 'Creating Ethereal Sender...' : 'New Sender'}
          </button>
        </div>

        {/* To + Upload CSV/TXT Lead List */}
        <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[260px] flex-wrap">
            <span className="w-14 text-sm text-gray-500 shrink-0">To</span>

            {visibleChips.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-[#00A63E]/30 px-3 py-1 text-xs font-medium text-gray-800"
              >
                {email}
                <button
                  type="button"
                  onClick={() => removeRecipient(email)}
                  className="text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {remainingCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 border border-[#00A63E]/30 px-2.5 py-1 text-xs font-semibold text-[#00A63E]">
                +{remainingCount}
              </span>
            )}

            <input
              type="text"
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  handleAddRecipientFromInput();
                }
              }}
              onBlur={handleAddRecipientFromInput}
              placeholder={
                recipients.length === 0
                  ? 'recipient@example.com (press Enter or Upload CSV)'
                  : 'Add another email...'
              }
              className="flex-1 min-w-[180px] text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            {recipients.length > 0 && (
              <span className="text-xs font-medium text-gray-500">
                {recipients.length} lead(s) detected
                {uploadedFileName ? ` from ${uploadedFileName}` : ''}
              </span>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00A63E] hover:underline cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload List
            </button>
          </div>
        </div>

        {/* Subject */}
        <div className="flex items-center gap-4 py-3 border-b border-gray-100">
          <span className="w-16 text-sm text-gray-500">Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
        </div>

        {/* Delay Between 2 Emails & Hourly Limit + Start Time Indicator (Matches Figma Row) */}
        <div className="flex items-center flex-wrap gap-6 py-3 border-b border-gray-100 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700">
              Delay between 2 emails
            </span>
            <input
              type="number"
              min={0}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
              className="w-16 rounded-lg border border-gray-200 px-2.5 py-1 text-center text-xs font-medium text-gray-800 focus:border-[#00A63E] focus:outline-none"
            />
            <span className="text-gray-400">sec</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700">Hourly Limit</span>
            <input
              type="number"
              min={1}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Number(e.target.value))}
              className="w-16 rounded-lg border border-gray-200 px-2.5 py-1 text-center text-xs font-medium text-gray-800 focus:border-[#00A63E] focus:outline-none"
            />
            <span className="text-gray-400">emails/hr</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700">Start Time</span>
            <input
              type="datetime-local"
              step="1"
              value={startTimeIso}
              onChange={(e) => {
                setStartTimeIso(e.target.value);
                setPresetOffsetMs(null);
                setSelectedPresetLabel(null);
              }}
              className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-800 focus:border-[#00A63E] focus:outline-none"
            />
          </div>
        </div>

        {/* Email Body Editor + Formatting Toolbar */}
        <div className="mt-4 flex-1 flex flex-col rounded-2xl bg-gray-50/70 border border-gray-100 p-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type Your Reply..."
            className="w-full flex-1 min-h-[260px] bg-transparent resize-none text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
          />

          <div className="flex items-center gap-3 pt-3 border-t border-gray-200/70 text-gray-400">
            <Bold className="w-4 h-4 hover:text-gray-700 cursor-pointer" />
            <Italic className="w-4 h-4 hover:text-gray-700 cursor-pointer" />
            <Underline className="w-4 h-4 hover:text-gray-700 cursor-pointer" />
            <AlignLeft className="w-4 h-4 hover:text-gray-700 cursor-pointer" />
            <List className="w-4 h-4 hover:text-gray-700 cursor-pointer" />
            <Link2 className="w-4 h-4 hover:text-gray-700 cursor-pointer" />
          </div>
        </div>
      </div>
    </div>
  );
};

