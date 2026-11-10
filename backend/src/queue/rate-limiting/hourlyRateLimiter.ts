import IORedis from 'ioredis';
import { env } from '../../config/env';
import { db } from '../../db';
import { RateLimitCheckResult } from '../../types';

/**
 * Queue Submodule: Hourly Rate Limiting Per Sender
 * - Enforces MAX_EMAILS_PER_HOUR_PER_SENDER safely across multiple worker instances
 *   using atomic Redis counters (`INCR` + `EXPIRE 3600`) or Prisma DB transactions.
 * - Computes the exact next-hour reschedule timestamp while preserving FIFO sequence order.
 */
export class HourlyRateLimiter {
  public getHourBucket(date = new Date()): string {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}-${hh}`;
  }

  public getStartOfNextHourMs(nowMs = Date.now()): number {
    const d = new Date(nowMs);
    d.setUTCMinutes(0, 0, 0);
    d.setUTCHours(d.getUTCHours() + 1);
    return d.getTime();
  }

  async checkAndIncrementSenderWindow(params: {
    senderId: string;
    hourlyLimit: number;
    delayBetweenEmailsMs: number;
    redisConnection: IORedis | null;
    isRedisConnected: boolean;
  }): Promise<RateLimitCheckResult> {
    const {
      senderId,
      hourlyLimit,
      delayBetweenEmailsMs,
      redisConnection,
      isRedisConnected,
    } = params;

    const limit =
      hourlyLimit > 0 ? hourlyLimit : env.MAX_EMAILS_PER_HOUR_PER_SENDER;
    const hourBucket = this.getHourBucket();
    const hourWindowKey = `ratelimit:${senderId}:${hourBucket}`;
    const startOfNextHourMs = this.getStartOfNextHourMs();
    const spacingMs = Math.max(
      delayBetweenEmailsMs,
      env.MIN_DELAY_BETWEEN_EMAILS_MS
    );

    if (isRedisConnected && redisConnection) {
      const currentCount = await redisConnection.incr(hourWindowKey);
      if (currentCount === 1) {
        await redisConnection.expire(hourWindowKey, 3600);
      }

      if (currentCount > limit) {
        const notifyLockKey = `slack_notified:${senderId}:${hourBucket}`;
        const lockSet = await redisConnection.set(
          notifyLockKey,
          '1',
          'EX',
          3600,
          'NX'
        );
        const isFirstHitInWindow = lockSet === 'OK';
        const overflowIndex = Math.max(0, currentCount - limit - 1);

        return {
          allowed: false,
          currentCount,
          limit,
          hourWindowKey,
          nextAvailableTimestampMs:
            startOfNextHourMs + overflowIndex * spacingMs,
          isFirstHitInWindow,
        };
      }

      return {
        allowed: true,
        currentCount,
        limit,
        hourWindowKey,
        nextAvailableTimestampMs: Date.now(),
        isFirstHitInWindow: false,
      };
    }

    const dbCheck = await db.checkAndIncrementRateLimitInDb(
      senderId,
      hourBucket,
      limit
    );
    const overflowIndex = Math.max(0, dbCheck.currentCount - limit - 1);

    return {
      allowed: dbCheck.allowed,
      currentCount: dbCheck.currentCount,
      limit,
      hourWindowKey,
      nextAvailableTimestampMs: dbCheck.allowed
        ? Date.now()
        : startOfNextHourMs + overflowIndex * spacingMs,
      isFirstHitInWindow: dbCheck.isFirstHitInWindow,
    };
  }
}

export const hourlyRateLimiter = new HourlyRateLimiter();

