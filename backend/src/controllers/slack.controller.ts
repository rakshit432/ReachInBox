import { Request, Response } from 'express';
import { env } from '../config/env';
import { slackService } from '../services/slack.service';

export class SlackController {
  /**
   * GET /api/slack/oauth/start?userId=...
   * Redirects the user to the real Slack OAuth 2.0 authorize page.
   */
  async startOAuth(req: Request, res: Response): Promise<void> {
    const userId = (req.query.userId as string) || '';
    if (!userId) {
      res.status(400).json({ error: 'userId query parameter is required' });
      return;
    }

    const authorizeUrl = slackService.getOAuthAuthorizeUrl(userId);
    res.redirect(authorizeUrl);
  }

  /**
   * GET /api/slack/oauth/callback?code=...&state=...
   * Exchanges OAuth code with Slack API, stores token/webhook per user in Prisma DB,
   * and redirects back to the frontend dashboard.
   */
  async oauthCallback(req: Request, res: Response): Promise<void> {
    try {
      const code = req.query.code as string | undefined;
      const stateUserId = req.query.state as string | undefined;
      const error = req.query.error as string | undefined;

      if (error || !code || !stateUserId) {
        res.redirect(
          `${env.FRONTEND_URL}?slack=error&message=${encodeURIComponent(
            error || 'Slack OAuth authorization cancelled'
          )}`
        );
        return;
      }

      const result = await slackService.handleOAuthCallback(code, stateUserId);
      res.redirect(
        `${env.FRONTEND_URL}?slack=connected&team=${encodeURIComponent(
          result.teamName
        )}`
      );
    } catch (err) {
      console.error('❌ [SlackController.oauthCallback] Error:', err);
      res.redirect(
        `${env.FRONTEND_URL}?slack=error&message=${encodeURIComponent(
          (err as Error).message
        )}`
      );
    }
  }

  /**
   * POST /api/slack/disconnect
   * Disconnects Slack for the user. Subsequent rate-limit hits do not notify.
   */
  async disconnect(req: Request, res: Response): Promise<void> {
    try {
      const userId =
        (req.body.userId as string) ||
        (req.headers['x-user-id'] as string) ||
        '';
      if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      const updatedUser = await slackService.disconnectSlack(userId);
      res.json({
        message: 'Slack disconnected',
        user: {
          ...updatedUser,
          slackConnected: false,
        },
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
}

export const slackController = new SlackController();
