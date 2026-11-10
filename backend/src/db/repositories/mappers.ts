import {
  EmailJobRecord,
  EmailStatus,
  SenderAccount,
  User,
} from '../../types';

export function mapUser(row: {
  id: string;
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string;
  slackAccessToken: string | null;
  slackWebhookUrl: string | null;
  slackChannelId: string | null;
  slackTeamName: string | null;
  createdAt: Date;
}): User {
  return {
    id: row.id,
    googleId: row.googleId,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatarUrl,
    slackAccessToken: row.slackAccessToken,
    slackWebhookUrl: row.slackWebhookUrl,
    slackChannelId: row.slackChannelId,
    slackTeamName: row.slackTeamName,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapSender(row: {
  id: string;
  userId: string;
  email: string;
  name: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  hourlyLimit: number;
  createdAt: Date;
}): SenderAccount {
  return {
    id: row.id,
    userId: row.userId,
    email: row.email,
    name: row.name,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpUser: row.smtpUser,
    smtpPass: row.smtpPass,
    hourlyLimit: row.hourlyLimit,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapEmailJob(row: {
  id: string;
  userId: string;
  senderId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date;
  sentAt: Date | null;
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
  etherealMessageId: string | null;
  etherealPreviewUrl: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}): EmailJobRecord {
  return {
    id: row.id,
    userId: row.userId,
    senderId: row.senderId,
    senderEmail: row.senderEmail,
    recipientEmail: row.recipientEmail,
    subject: row.subject,
    body: row.body,
    status: row.status as EmailStatus,
    scheduledAt: row.scheduledAt.toISOString(),
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    delayBetweenEmailsMs: row.delayBetweenEmailsMs,
    hourlyLimit: row.hourlyLimit,
    etherealMessageId: row.etherealMessageId,
    etherealPreviewUrl: row.etherealPreviewUrl,
    errorMessage: row.errorMessage,
    retryCount: row.retryCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

