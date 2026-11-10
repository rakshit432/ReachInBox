import { prisma } from '../prisma';

export class RateLimitRepository {
  async checkAndIncrementRateLimitInDb(
    senderId: string,
    hourBucket: string,
    limit: number
  ): Promise<{
    allowed: boolean;
    currentCount: number;
    isFirstHitInWindow: boolean;
  }> {
    const windowKey = `ratelimit:${senderId}:${hourBucket}`;

    return prisma.$transaction(async (tx) => {
      const existing = await tx.rateLimitWindow.upsert({
        where: { windowKey },
        update: {},
        create: {
          windowKey,
          senderId,
          hourBucket,
          count: 0,
          slackNotified: false,
        },
      });

      if (existing.count >= limit) {
        const isFirstHit = !existing.slackNotified;
        if (isFirstHit) {
          await tx.rateLimitWindow.update({
            where: { windowKey },
            data: { slackNotified: true },
          });
        }
        return {
          allowed: false,
          currentCount: existing.count + 1,
          isFirstHitInWindow: isFirstHit,
        };
      }

      const updated = await tx.rateLimitWindow.update({
        where: { windowKey },
        data: { count: { increment: 1 } },
      });

      return {
        allowed: true,
        currentCount: updated.count,
        isFirstHitInWindow: false,
      };
    });
  }
}

export const rateLimitRepository = new RateLimitRepository();

