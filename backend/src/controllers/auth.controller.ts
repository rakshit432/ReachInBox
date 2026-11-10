import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { db } from '../db';
import { smtpService } from '../services/smtp.service';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export class AuthController {
  /**
   * POST /api/auth/google
   * Verifies a real Google OAuth 2.0 ID token (`credential`) or `accessToken`
   * using `google-auth-library` / Google OAuth2 UserInfo endpoint.
   */
  async googleLogin(req: Request, res: Response): Promise<void> {
    try {
      const { credential, accessToken } = req.body as {
        credential?: string;
        accessToken?: string;
      };

      if (!credential && !accessToken) {
        res.status(400).json({
          error: 'Google OAuth credential or accessToken is required',
        });
        return;
      }

      let googleId = '';
      let email = '';
      let name = '';
      let avatarUrl = '';

      if (credential) {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: env.GOOGLE_CLIENT_ID || undefined,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          res.status(401).json({ error: 'Invalid Google ID token' });
          return;
        }
        googleId = payload.sub;
        email = payload.email;
        name = payload.name || payload.email.split('@')[0];
        avatarUrl = payload.picture || '';
      } else if (accessToken) {
        const userInfoRes = await fetch(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (!userInfoRes.ok) {
          res
            .status(401)
            .json({ error: 'Failed to verify Google access token' });
          return;
        }
        const info = (await userInfoRes.json()) as {
          sub: string;
          email: string;
          name?: string;
          picture?: string;
        };
        googleId = info.sub;
        email = info.email;
        name = info.name || info.email.split('@')[0];
        avatarUrl = info.picture || '';
      }

      const user = await db.upsertUser({
        id: uuidv4(),
        googleId,
        email,
        name,
        avatarUrl,
      });

      const senders = await smtpService.ensureDefaultSendersForUser(user.id);

      res.json({
        user: {
          ...user,
          slackConnected: Boolean(
            user.slackWebhookUrl || user.slackAccessToken
          ),
        },
        senders,
      });
    } catch (err) {
      console.error('❌ [AuthController.googleLogin] Error:', err);
      res.status(401).json({
        error: (err as Error).message || 'Google OAuth verification failed',
      });
    }
  }

  /**
   * GET /api/auth/me?userId=...
   * Returns current authenticated user profile, Slack connection status, and Ethereal senders.
   */
  async getMe(req: Request, res: Response): Promise<void> {
    try {
      const userId =
        (req.query.userId as string) ||
        (req.headers['x-user-id'] as string) ||
        '';
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const user = await db.getUserById(userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const senders = await smtpService.ensureDefaultSendersForUser(user.id);

      res.json({
        user: {
          ...user,
          slackConnected: Boolean(
            user.slackWebhookUrl || user.slackAccessToken
          ),
        },
        senders,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
}

export const authController = new AuthController();
