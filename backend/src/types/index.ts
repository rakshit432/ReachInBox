export type EmailStatus =
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'RATE_LIMITED'
  | 'SENT'
  | 'FAILED';

export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string;
  slackAccessToken?: string | null;
  slackWebhookUrl?: string | null;
  slackChannelId?: string | null;
  slackTeamName?: string | null;
  createdAt: string;
}

export interface SenderAccount {
  id: string;
  userId: string;
  email: string;
  name: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  hourlyLimit: number;
  createdAt: string;
}

export interface EmailJobRecord {
  id: string;
  userId: string;
  senderId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt?: string | null;
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
  etherealMessageId?: string | null;
  etherealPreviewUrl?: string | null;
  errorMessage?: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmailQueuePayload {
  emailJobId: string;
  userId: string;
  senderId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
}

export interface ScheduleBatchRequest {
  senderId?: string;
  senderEmail?: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmailsSeconds: number;
  hourlyLimit: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  hourWindowKey: string;
  nextAvailableTimestampMs: number;
  isFirstHitInWindow: boolean;
}

