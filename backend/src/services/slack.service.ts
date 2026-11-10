import { env } from '../config/env';
import { db } from '../db';

class SlackService {
  /**
   * Builds the real Slack OAuth 2.0 Authorize URL for the "Connect Slack" button.
   */
  getOAuthAuthorizeUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      scope: 'incoming-webhook,chat:write',
      redirect_uri: env.SLACK_REDIRECT_URI,
      state: userId,
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchanges the OAuth `code` from Slack for a live access token / incoming webhook
   * and stores it per user in PostgreSQL via Prisma.
   */
  async handleOAuthCallback(
    code: string,
    userId: string
  ): Promise<{ teamName: string; channelId: string }> {
    const body = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_REDIRECT_URI,
    });

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = (await response.json()) as {
      ok: boolean;
      error?: string;
      access_token?: string;
      team?: { name?: string };
      incoming_webhook?: {
        url?: string;
        channel?: string;
        channel_id?: string;
      };
    };

    if (!data.ok) {
      throw new Error(
        `Slack OAuth exchange failed: ${data.error || 'Unknown error'}`
      );
    }

    const accessToken = data.access_token || null;
    const webhookUrl = data.incoming_webhook?.url || null;
    const channelId =
      data.incoming_webhook?.channel_id ||
      data.incoming_webhook?.channel ||
      'general';
    const teamName = data.team?.name || 'Slack Workspace';

    await db.updateUserSlackConfig(userId, {
      accessToken,
      webhookUrl,
      channelId,
      teamName,
    });

    return { teamName, channelId };
  }

  /**
   * Disconnects Slack for the user. Subsequent rate-limit hits do not notify and do not crash.
   */
  async disconnectSlack(userId: string) {
    return db.updateUserSlackConfig(userId, {
      accessToken: null,
      webhookUrl: null,
      channelId: null,
      teamName: null,
    });
  }

  /**
   * Sends a live Slack message the moment a sender's hourly limit is reached.
   * Safe no-op if the user hasn't connected Slack or has disconnected it.
   */
  async notifyRateLimitHit(params: {
    userId: string;
    senderEmail: string;
    hourlyLimit: number;
    currentAttemptCount: number;
    hourWindowKey: string;
    nextAvailableTimeIso: string;
  }): Promise<boolean> {
    const user = await db.getUserById(params.userId);
    if (!user) return false;

    const hasWebhook = Boolean(user.slackWebhookUrl);
    const hasToken = Boolean(user.slackAccessToken && user.slackChannelId);

    if (!hasWebhook && !hasToken) {
      return false;
    }

    const messageText =
      `🚨 *ReachInbox Rate Limit Reached*\n` +
      `• *Sender:* \`${params.senderEmail}\`\n` +
      `• *Hourly Limit:* \`${params.hourlyLimit} emails/hr\` (Window: \`${params.hourWindowKey}\`)\n` +
      `• *Action Taken:* Remaining queued emails have been delayed to the next hourly window starting at *${new Date(
        params.nextAvailableTimeIso
      ).toLocaleTimeString()}*.`;

    try {
      if (user.slackWebhookUrl) {
        const res = await fetch(user.slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: messageText }),
        });
        if (res.ok) {
          console.log(
            `🔔 [Slack] Live rate-limit alert sent via Webhook for sender ${params.senderEmail}`
          );
          return true;
        }
      }

      if (user.slackAccessToken && user.slackChannelId) {
        const res = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: `Bearer ${user.slackAccessToken}`,
          },
          body: JSON.stringify({
            channel: user.slackChannelId,
            text: messageText,
          }),
        });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if (data.ok) {
          console.log(
            `🔔 [Slack] Live rate-limit alert sent via chat.postMessage to ${user.slackChannelId}`
          );
          return true;
        }
      }
    } catch (err) {
      console.warn(
        `⚠️ [Slack] Notification warning for user ${params.userId}:`,
        (err as Error).message
      );
    }

    return false;
  }
}

export const slackService = new SlackService();
