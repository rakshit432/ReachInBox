import { prisma } from '../prisma';
import { EmailJobRecord, EmailStatus } from '../../types';
import { mapEmailJob } from './mappers';

export class EmailJobRepository {
  async createEmailJob(job: EmailJobRecord): Promise<EmailJobRecord> {
    const record = await prisma.emailJob.upsert({
      where: { id: job.id },
      update: {},
      create: {
        id: job.id,
        userId: job.userId,
        senderId: job.senderId,
        senderEmail: job.senderEmail,
        recipientEmail: job.recipientEmail,
        subject: job.subject,
        body: job.body,
        status: job.status,
        scheduledAt: new Date(job.scheduledAt),
        sentAt: job.sentAt ? new Date(job.sentAt) : null,
        delayBetweenEmailsMs: job.delayBetweenEmailsMs,
        hourlyLimit: job.hourlyLimit,
        etherealMessageId: job.etherealMessageId ?? null,
        etherealPreviewUrl: job.etherealPreviewUrl ?? null,
        errorMessage: job.errorMessage ?? null,
        retryCount: job.retryCount,
      },
    });
    return mapEmailJob(record);
  }

  async getEmailJobById(id: string): Promise<EmailJobRecord | null> {
    const record = await prisma.emailJob.findUnique({ where: { id } });
    return record ? mapEmailJob(record) : null;
  }

  async updateEmailJobStatus(
    id: string,
    updates: {
      status: EmailStatus;
      scheduledAt?: string;
      sentAt?: string | null;
      etherealMessageId?: string | null;
      etherealPreviewUrl?: string | null;
      errorMessage?: string | null;
      retryCount?: number;
    }
  ): Promise<EmailJobRecord | null> {
    const existing = await prisma.emailJob.findUnique({ where: { id } });
    if (!existing) return null;

    const record = await prisma.emailJob.update({
      where: { id },
      data: {
        status: updates.status,
        scheduledAt: updates.scheduledAt
          ? new Date(updates.scheduledAt)
          : existing.scheduledAt,
        sentAt:
          updates.sentAt !== undefined
            ? updates.sentAt
              ? new Date(updates.sentAt)
              : null
            : existing.sentAt,
        etherealMessageId:
          updates.etherealMessageId !== undefined
            ? updates.etherealMessageId
            : existing.etherealMessageId,
        etherealPreviewUrl:
          updates.etherealPreviewUrl !== undefined
            ? updates.etherealPreviewUrl
            : existing.etherealPreviewUrl,
        errorMessage:
          updates.errorMessage !== undefined
            ? updates.errorMessage
            : existing.errorMessage,
        retryCount:
          updates.retryCount !== undefined
            ? updates.retryCount
            : existing.retryCount,
      },
    });
    return mapEmailJob(record);
  }

  async getEmailJobsByUser(
    userId: string,
    tab?: 'scheduled' | 'sent'
  ): Promise<EmailJobRecord[]> {
    const statusIn =
      tab === 'scheduled'
        ? ['SCHEDULED', 'PROCESSING', 'RATE_LIMITED']
        : tab === 'sent'
        ? ['SENT', 'FAILED']
        : undefined;

    const rows = await prisma.emailJob.findMany({
      where: {
        userId,
        ...(statusIn ? { status: { in: statusIn } } : {}),
      },
      orderBy: tab === 'sent' ? { sentAt: 'desc' } : { scheduledAt: 'asc' },
    });
    return rows.map((r: (typeof rows)[number]) => mapEmailJob(r));
  }

  async getPendingEmailJobsForRecovery(): Promise<EmailJobRecord[]> {
    const rows = await prisma.emailJob.findMany({
      where: {
        status: { in: ['SCHEDULED', 'PROCESSING', 'RATE_LIMITED'] },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    return rows.map((r: (typeof rows)[number]) => mapEmailJob(r));
  }

  async searchEmailJobsInDb(
    userId: string,
    query: string,
    tab?: 'scheduled' | 'sent'
  ): Promise<EmailJobRecord[]> {
    const all = await this.getEmailJobsByUser(userId, tab);
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (job) =>
        job.recipientEmail.toLowerCase().includes(q) ||
        job.subject.toLowerCase().includes(q) ||
        job.body.toLowerCase().includes(q) ||
        job.senderEmail.toLowerCase().includes(q) ||
        job.status.toLowerCase().includes(q)
    );
  }
}

export const emailJobRepository = new EmailJobRepository();

