import { prisma } from '../prisma';
import { env } from '../../config/env';
import { User } from '../../types';
import { mapUser } from './mappers';

export class UserRepository {
  async upsertUser(user: {
    id: string;
    googleId: string;
    email: string;
    name: string;
    avatarUrl: string;
  }): Promise<User> {
    const defaultWebhook = env.SLACK_DEFAULT_WEBHOOK_URL || null;
    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        avatarUrl: user.avatarUrl,
        googleId: user.googleId,
      },
      create: {
        id: user.id,
        googleId: user.googleId,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        slackWebhookUrl: defaultWebhook,
      },
    });
    return mapUser(record);
  }

  async getUserById(id: string): Promise<User | null> {
    const record = await prisma.user.findUnique({ where: { id } });
    return record ? mapUser(record) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const record = await prisma.user.findUnique({ where: { email } });
    return record ? mapUser(record) : null;
  }

  async updateUserSlackConfig(
    userId: string,
    slack: {
      accessToken?: string | null;
      webhookUrl?: string | null;
      channelId?: string | null;
      teamName?: string | null;
    }
  ): Promise<User | null> {
    const record = await prisma.user.update({
      where: { id: userId },
      data: {
        slackAccessToken: slack.accessToken ?? null,
        slackWebhookUrl: slack.webhookUrl ?? null,
        slackChannelId: slack.channelId ?? null,
        slackTeamName: slack.teamName ?? null,
      },
    });
    return mapUser(record);
  }
}

export const userRepository = new UserRepository();

