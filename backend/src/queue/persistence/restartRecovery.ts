import { db } from '../../db';
import { EmailJobRecord, EmailQueuePayload } from '../../types';

/**
 * Queue Submodule: Server Restart Persistence & Idempotency
 * - Recovers pending SCHEDULED / PROCESSING / RATE_LIMITED emails from PostgreSQL (Prisma) on startup.
 * - Prevents duplicate sends via `isAlreadySent` idempotency guard.
 */
export class RestartPersistenceManager {
  public isAlreadySent(jobRecord: EmailJobRecord): boolean {
    if (jobRecord.status === 'SENT') {
      console.log(
        `⏭️  [Persistence/Idempotency] Skipping job ${jobRecord.id} — already SENT at ${jobRecord.sentAt}`
      );
      return true;
    }
    return false;
  }

  public async recoverPendingJobsOnStartup(
    scheduleFn: (
      payload: EmailQueuePayload,
      scheduledAtIso: string
    ) => Promise<void>
  ): Promise<void> {
    const pendingJobs = await db.getPendingEmailJobsForRecovery();
    if (pendingJobs.length === 0) {
      console.log(
        '✅ [Persistence/Recovery] All scheduled jobs up to date (0 pending recovery)'
      );
      return;
    }

    console.log(
      `🔄 [Persistence/Recovery] Restoring ${pendingJobs.length} scheduled email job(s) from database after server restart...`
    );

    for (const job of pendingJobs) {
      await scheduleFn(
        {
          emailJobId: job.id,
          userId: job.userId,
          senderId: job.senderId,
          senderEmail: job.senderEmail,
          recipientEmail: job.recipientEmail,
          subject: job.subject,
          body: job.body,
          delayBetweenEmailsMs: job.delayBetweenEmailsMs,
          hourlyLimit: job.hourlyLimit,
        },
        job.scheduledAt
      );
    }
  }
}

export const restartPersistenceManager = new RestartPersistenceManager();

