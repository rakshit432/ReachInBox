import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { env } from '../config/env';
import { db } from '../db';
import { smtpService } from '../services/smtp.service';
import { elasticsearchService } from '../services/elasticsearch.service';
import { emailQueueManager } from '../queue';
import { EmailJobRecord } from '../types';

const scheduleBatchSchema = z.object({
  userId: z.string().min(1),
  senderId: z.string().optional(),
  recipients: z.array(z.string().email()).min(1),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Email body is required'),
  startTime: z.string().optional(),
  delayBetweenEmailsSeconds: z.number().min(0).optional(),
  hourlyLimit: z.number().min(1).optional(),
});

export class EmailController {
  /**
   * POST /api/emails/schedule
   * Accepts single or bulk (CSV-parsed) email schedule requests,
   * stores each email in PostgreSQL (Prisma), indexes in Elasticsearch,
   * and schedules delayed jobs in BullMQ (no cron).
   */
  async scheduleEmails(req: Request, res: Response): Promise<void> {
    try {
      const userId =
        (req.body.userId as string) ||
        (req.headers['x-user-id'] as string) ||
        '';

      const parsed = scheduleBatchSchema.safeParse({
        ...req.body,
        userId,
      });

      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid schedule request payload',
          details: parsed.error.issues,
        });
        return;
      }

      const {
        senderId,
        recipients,
        subject,
        body,
        startTime,
        delayBetweenEmailsSeconds,
        hourlyLimit,
      } = parsed.data;

      // Ensure user has sender account(s)
      const userSenders = await smtpService.ensureDefaultSendersForUser(userId);
      const selectedSender =
        (senderId
          ? userSenders.find((s) => s.id === senderId)
          : userSenders[0]) || userSenders[0];

      const delayMs =
        delayBetweenEmailsSeconds !== undefined
          ? Math.max(
              delayBetweenEmailsSeconds * 1000,
              env.MIN_DELAY_BETWEEN_EMAILS_MS
            )
          : env.MIN_DELAY_BETWEEN_EMAILS_MS;

      const effectiveHourlyLimit =
        hourlyLimit ||
        selectedSender.hourlyLimit ||
        env.MAX_EMAILS_PER_HOUR_PER_SENDER;

      const baseStartMs = startTime
        ? Math.max(Date.now(), new Date(startTime).getTime())
        : Date.now();

      const createdJobs: EmailJobRecord[] = [];
      const uniqueRecipients = Array.from(
        new Set(recipients.map((r) => r.trim().toLowerCase()))
      );

      for (let i = 0; i < uniqueRecipients.length; i++) {
        const recipientEmail = uniqueRecipients[i];
        // Stagger initial schedule time by index * delayMs while worker also enforces hourly rate window
        const scheduledAtIso = new Date(
          baseStartMs + i * delayMs
        ).toISOString();
        const nowIso = new Date().toISOString();

        const emailJob: EmailJobRecord = {
          id: uuidv4(),
          userId,
          senderId: selectedSender.id,
          senderEmail: selectedSender.email,
          recipientEmail,
          subject,
          body,
          status: 'SCHEDULED',
          scheduledAt: scheduledAtIso,
          sentAt: null,
          delayBetweenEmailsMs: delayMs,
          hourlyLimit: effectiveHourlyLimit,
          etherealMessageId: null,
          etherealPreviewUrl: null,
          errorMessage: null,
          retryCount: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        const saved = await db.createEmailJob(emailJob);
        await elasticsearchService.indexEmailJob(saved);

        await emailQueueManager.scheduleEmailJob(
          {
            emailJobId: saved.id,
            userId: saved.userId,
            senderId: saved.senderId,
            senderEmail: saved.senderEmail,
            recipientEmail: saved.recipientEmail,
            subject: saved.subject,
            body: saved.body,
            delayBetweenEmailsMs: saved.delayBetweenEmailsMs,
            hourlyLimit: saved.hourlyLimit,
          },
          saved.scheduledAt
        );

        createdJobs.push(saved);
      }

      res.status(201).json({
        message: `Successfully scheduled ${createdJobs.length} email(s)`,
        count: createdJobs.length,
        sender: selectedSender.email,
        delayBetweenEmailsMs: delayMs,
        hourlyLimit: effectiveHourlyLimit,
        jobs: createdJobs,
      });
    } catch (err) {
      console.error('❌ [EmailController.scheduleEmails] Error:', err);
      res.status(500).json({
        error: (err as Error).message || 'Failed to schedule emails',
      });
    }
  }

  /**
   * GET /api/emails?userId=...&tab=scheduled|sent&q=...
   * Lists scheduled or sent emails for the dashboard, or runs Elasticsearch search if `q` is provided.
   */
  async listEmails(req: Request, res: Response): Promise<void> {
    try {
      const userId =
        (req.query.userId as string) ||
        (req.headers['x-user-id'] as string) ||
        '';
      const tab = req.query.tab as 'scheduled' | 'sent' | undefined;
      const searchQuery = ((req.query.q as string) || '').trim();

      if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      if (searchQuery) {
        const searchRes = await elasticsearchService.searchEmails(
          userId,
          searchQuery,
          tab
        );
        res.json({
          emails: searchRes.results,
          searchEngine: searchRes.engine,
        });
        return;
      }

      const emails = await db.getEmailJobsByUser(userId, tab);
      const allScheduled = await db.getEmailJobsByUser(userId, 'scheduled');
      const allSent = await db.getEmailJobsByUser(userId, 'sent');

      res.json({
        emails,
        counts: {
          scheduled: allScheduled.length,
          sent: allSent.length,
        },
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }

  /**
   * GET /api/emails/search?userId=...&q=...&tab=...
   * Dedicated Elasticsearch search endpoint for scheduled and sent emails.
   */
  async searchEmails(req: Request, res: Response): Promise<void> {
    try {
      const userId =
        (req.query.userId as string) ||
        (req.headers['x-user-id'] as string) ||
        '';
      const q = ((req.query.q as string) || '').trim();
      const tab = req.query.tab as 'scheduled' | 'sent' | undefined;

      if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      const result = await elasticsearchService.searchEmails(userId, q, tab);
      res.json({
        emails: result.results,
        engine: result.engine,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }

  /**
   * GET /api/emails/:id
   * Fetches full detail of a scheduled or sent email.
   */
  async getEmailById(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const job = await db.getEmailJobById(id);
      if (!job) {
        res.status(404).json({ error: 'Email job not found' });
        return;
      }
      res.json({ email: job });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
}

export const emailController = new EmailController();
