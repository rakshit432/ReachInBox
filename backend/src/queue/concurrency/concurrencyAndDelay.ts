import { env } from '../../config/env';

/**
 * Queue Submodule: Concurrency & Minimum Delay Between Emails
 * - Configures BullMQ Worker concurrency (`WORKER_CONCURRENCY`) and limiter (`MIN_DELAY_BETWEEN_EMAILS_MS`).
 * - Enforces per-sender minimum delay between individual email sends.
 */
export class ConcurrencyAndDelayThrottle {
  private lastSendTimestampBySender: Map<string, number> = new Map();

  public getWorkerConcurrencyConfig() {
    return {
      concurrency: env.WORKER_CONCURRENCY,
      limiter: {
        max: 1,
        duration: env.MIN_DELAY_BETWEEN_EMAILS_MS,
      },
    };
  }

  public async enforceMinimumDelayBetweenSends(
    senderId: string,
    customDelayMs?: number
  ): Promise<number> {
    const minDelayMs = Math.max(
      customDelayMs || 0,
      env.MIN_DELAY_BETWEEN_EMAILS_MS
    );
    const lastSent = this.lastSendTimestampBySender.get(senderId) || 0;
    const elapsed = Date.now() - lastSent;

    if (elapsed < minDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, minDelayMs - elapsed));
    }

    this.lastSendTimestampBySender.set(senderId, Date.now());
    return minDelayMs;
  }
}

export const concurrencyAndDelayThrottle = new ConcurrencyAndDelayThrottle();

