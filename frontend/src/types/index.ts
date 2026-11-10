export type EmailStatus =
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'RATE_LIMITED'
  | 'SENT'
  | 'FAILED';

export type DashboardTab = 'scheduled' | 'sent';

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
  slackConnected: boolean;
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
  hourlyLimit: number;
  createdAt: string;
}

export interface EmailJob {
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

export interface ScheduleEmailsPayload {
  userId: string;
  senderId?: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime?: string;
  delayBetweenEmailsSeconds: number;
  hourlyLimit: number;
}

export interface ScheduleEmailsResponse {
  message: string;
  count: number;
  sender: string;
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
  jobs: EmailJob[];
}

export interface ListEmailsResponse {
  emails: EmailJob[];
  counts?: {
    scheduled: number;
    sent: number;
  };
  searchEngine?: 'elasticsearch' | 'database';
}

