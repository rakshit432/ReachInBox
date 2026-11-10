import { Queue, Worker, DelayedError, Job } from 'bullmq';
import IORedis from 'ioredis';
import { Router } from 'express';
import { env } from '../../config/env';
import { db } from '../../db';
import { smtpService } from '../../services/smtp.service';
import { elasticsearchService } from '../../services/elasticsearch.service';
import { slackService } from '../../services/slack.service';
import { hourlyRateLimiter } from '../rate-limiting/hourlyRateLimiter';
import { restartPersistenceManager } from '../persistence/restartRecovery';
import { concurrencyAndDelayThrottle } from '../concurrency/concurrencyAndDelay';
import { bullBoardDashboard } from '../dashboard/bullBoardDashboard';
import { EmailQueuePayload } from '../../types';

export const EMAIL_QUEUE_NAME = 'reachinbox-email-scheduler';

export class BullMQEmailScheduler {
  private redisConnection!: IORedis;
  private workerRedisConnection!: IORedis;
  private queue!: Queue<EmailQueuePayload>;
  private worker!: Worker<EmailQueuePayload>;

  async init(): Promise<void> {
    this.redisConnection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
    this.workerRedisConnection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue<EmailQueuePayload>(EMAIL_QUEUE_NAME, {
      connection: this.redisConnection as any,
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      },
    });

    bullBoardDashboard.attachQueue(this.queue);

    const workerConfig =
      concurrencyAndDelayThrottle.getWorkerConcurrencyConfig();

    this.worker = new Worker<EmailQueuePayload>(
      EMAIL_QUEUE_NAME,
      async (job: Job<EmailQueuePayload>, token?: string) => {
        await this.processEmailJob(job.data, async (nextTimestampMs: number) => {
          if (token) {
            await job.moveToDelayed(nextTimestampMs, token);
            throw new DelayedError();
          }
        });
      },
      {
        connection: this.workerRedisConnection as any,
        concurrency: workerConfig.concurrency,
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`✅ [BullMQ Worker] Completed job ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ [BullMQ Worker] Failed job ${job?.id}:`, err.message);
    });

    console.log(
      `✅ [BullMQ Scheduler] Connected to Redis (${env.REDIS_URL}) | Concurrency=${workerConfig.concurrency} | MinDelay=${workerConfig.limiter.duration}ms`
    );

    await restartPersistenceManager.recoverPendingJobsOnStartup(
      (payload, scheduledAtIso) =>
        this.scheduleEmailJob(payload, scheduledAtIso)
    );
  }

  public getBullBoardRouter(): Router {
    return bullBoardDashboard.getRouter();
  }

  /**
   * Schedules an email job using BullMQ delayed jobs (no cron).
   * Deterministic jobId = emailJobId prevents duplicate scheduling.
   */
  async scheduleEmailJob(
    payload: EmailQueuePayload,
    scheduledAtIso: string
  ): Promise<void> {
    const targetMs = new Date(scheduledAtIso).getTime();
    const delayMs = Math.max(0, targetMs - Date.now());

    const existingJob = await this.queue.getJob(payload.emailJobId);
    if (existingJob) return;

    await this.queue.add('send-email', payload, {
      jobId: payload.emailJobId,
      delay: delayMs,
    });
  }

  private async processEmailJob(
    payload: EmailQueuePayload,
    onRescheduleDelayed: (nextTimestampMs: number) => Promise<void>
  ): Promise<void> {
    const jobRecord = await db.getEmailJobById(payload.emailJobId);
    if (!jobRecord) return;

    // 1. Idempotency Guard: Never send the same email more than once
    if (restartPersistenceManager.isAlreadySent(jobRecord)) {
      return;
    }

    // 2. Distributed Hourly Rate Limit Check per Sender (checked BEFORE sleeping for send delay)
    const minDelayMs = Math.max(
      payload.delayBetweenEmailsMs || 0,
      env.MIN_DELAY_BETWEEN_EMAILS_MS
    );

    const rateCheck = await hourlyRateLimiter.checkAndIncrementSenderWindow({
      senderId: payload.senderId,
      hourlyLimit: payload.hourlyLimit,
      delayBetweenEmailsMs: minDelayMs,
      redisConnection: this.redisConnection,
      isRedisConnected: true,
    });

    if (!rateCheck.allowed) {
      const nextIso = new Date(
        rateCheck.nextAvailableTimestampMs
      ).toISOString();
      console.warn(
        `⏳ [Rate Limiter] Hourly limit (${rateCheck.limit}/hr) reached for sender ${payload.senderEmail}. Rescheduling job ${payload.emailJobId} to ${nextIso}`
      );

      const updated = await db.updateEmailJobStatus(payload.emailJobId, {
        status: 'RATE_LIMITED',
        scheduledAt: nextIso,
      });
      if (updated) {
        await elasticsearchService.indexEmailJob(updated);
      }

      if (rateCheck.isFirstHitInWindow) {
        await slackService.notifyRateLimitHit({
          userId: payload.userId,
          senderEmail: payload.senderEmail,
          hourlyLimit: rateCheck.limit,
          currentAttemptCount: rateCheck.currentCount,
          hourWindowKey: rateCheck.hourWindowKey,
          nextAvailableTimeIso: nextIso,
        });
      }

      await onRescheduleDelayed(rateCheck.nextAvailableTimestampMs);
      return;
    }

    // 3. Enforce Minimum Delay Between Emails (throttling)
    await concurrencyAndDelayThrottle.enforceMinimumDelayBetweenSends(
      payload.senderId,
      payload.delayBetweenEmailsMs
    );

    // 4. Mark PROCESSING & Send via Multi-Sender Ethereal SMTP
    await db.updateEmailJobStatus(payload.emailJobId, {
      status: 'PROCESSING',
    });

    const sender = await db.getSenderAccountById(payload.senderId);
    if (!sender) {
      const failed = await db.updateEmailJobStatus(payload.emailJobId, {
        status: 'FAILED',
        errorMessage: 'Sender account not found',
      });
      if (failed) await elasticsearchService.indexEmailJob(failed);
      return;
    }

    try {
      const smtpResult = await smtpService.sendEmailViaEthereal({
        sender,
        recipientEmail: payload.recipientEmail,
        subject: payload.subject,
        body: payload.body,
      });

      const sentRecord = await db.updateEmailJobStatus(payload.emailJobId, {
        status: 'SENT',
        sentAt: new Date().toISOString(),
        etherealMessageId: smtpResult.messageId,
        etherealPreviewUrl: smtpResult.previewUrl,
        errorMessage: null,
      });

      if (sentRecord) {
        await elasticsearchService.indexEmailJob(sentRecord);
      }
    } catch (err) {
      const errorMsg = (err as Error).message || 'SMTP send error';
      const failedRecord = await db.updateEmailJobStatus(payload.emailJobId, {
        status: 'FAILED',
        errorMessage: errorMsg,
        retryCount: jobRecord.retryCount + 1,
      });
      if (failedRecord) {
        await elasticsearchService.indexEmailJob(failedRecord);
      }
      throw err;
    }
  }
}

export const emailQueueManager = new BullMQEmailScheduler();
