import { Request, Response } from 'express';
import { smtpService } from '../services/smtp.service';

export class SenderController {
  /**
   * GET /api/senders?userId=...
   * Returns all multi-sender Ethereal SMTP accounts for the user.
   */
  async listSenders(req: Request, res: Response): Promise<void> {
    try {
      const userId =
        (req.query.userId as string) ||
        (req.headers['x-user-id'] as string) ||
        '';
      if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }
      const senders = await smtpService.ensureDefaultSendersForUser(userId);
      res.json({ senders });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }

  /**
   * POST /api/senders
   * Creates a new multi-sender Ethereal Email SMTP account for the user.
   */
  async createSender(req: Request, res: Response): Promise<void> {
    try {
      const userId =
        (req.body.userId as string) ||
        (req.headers['x-user-id'] as string) ||
        '';
      const { email, name, hourlyLimit } = req.body as {
        email?: string;
        name?: string;
        hourlyLimit?: number;
      };

      if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      const sender = await smtpService.createEtherealSenderAccount(
        userId,
        email,
        name,
        hourlyLimit,
        !email
      );
      res.status(201).json({ sender });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
}

export const senderController = new SenderController();

