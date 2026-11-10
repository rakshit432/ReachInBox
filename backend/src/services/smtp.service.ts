import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { db } from '../db';
import { SenderAccount } from '../types';

class SmtpService {
  /**
   * Provisions a new Ethereal SMTP sender account via `nodemailer.createTestAccount()`
   * (or uses configured ETHEREAL_USER / ETHEREAL_PASS from `.env` if not yet provisioned).
   */
  async createEtherealSenderAccount(
    userId: string,
    customEmail?: string,
    customName?: string,
    hourlyLimit?: number,
    forceFreshTestAccount = false
  ): Promise<SenderAccount> {
    let smtpHost = env.ETHEREAL_HOST || 'smtp.ethereal.email';
    let smtpPort = env.ETHEREAL_PORT || 587;
    let smtpUser = env.ETHEREAL_USER;
    let smtpPass = env.ETHEREAL_PASS;

    if (forceFreshTestAccount || !smtpUser || !smtpPass) {
      const testAccount = await nodemailer.createTestAccount();
      smtpHost = testAccount.smtp.host;
      smtpPort = testAccount.smtp.port;
      smtpUser = testAccount.user;
      smtpPass = testAccount.pass;
    }

    const sender: SenderAccount = {
      id: uuidv4(),
      userId,
      email: customEmail || smtpUser,
      name:
        customName ||
        `Outbox Sender (${(customEmail || smtpUser).split('@')[0]})`,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      hourlyLimit: hourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER,
      createdAt: new Date().toISOString(),
    };

    return db.createSenderAccount(sender);
  }

  /**
   * Ensures the logged-in user has their configured `.env` Ethereal account
   * plus multi-sender Ethereal accounts ready.
   */
  async ensureDefaultSendersForUser(userId: string): Promise<SenderAccount[]> {
    const existing = await db.getSenderAccountsByUser(userId);

    // If ETHEREAL_USER is set in .env, ensure it exists in the user's sender list
    if (
      env.ETHEREAL_USER &&
      env.ETHEREAL_PASS &&
      !existing.some((s) => s.email === env.ETHEREAL_USER)
    ) {
      const envSender = await this.createEtherealSenderAccount(
        userId,
        env.ETHEREAL_USER,
        `Primary Ethereal (${env.ETHEREAL_USER.split('@')[0]})`,
        env.MAX_EMAILS_PER_HOUR_PER_SENDER,
        false
      );
      existing.unshift(envSender);
    }

    if (existing.length > 0) {
      return existing;
    }

    const primary = await this.createEtherealSenderAccount(
      userId,
      undefined,
      'Primary Outreach Sender',
      env.MAX_EMAILS_PER_HOUR_PER_SENDER,
      false
    );
    const secondary = await this.createEtherealSenderAccount(
      userId,
      undefined,
      'Secondary Growth Sender',
      env.MAX_EMAILS_PER_HOUR_PER_SENDER,
      true
    );

    return [primary, secondary];
  }

  /**
   * Dispatches an email via Ethereal Email (SMTP) using the sender's credentials.
   * Any SMTP failure throws so the worker marks the email job as FAILED.
   */
  async sendEmailViaEthereal(params: {
    sender: SenderAccount;
    recipientEmail: string;
    subject: string;
    body: string;
  }): Promise<{ messageId: string; previewUrl: string | null }> {
    const { sender, recipientEmail, subject, body } = params;

    const transporter = nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: sender.smtpPort === 465,
      auth: {
        user: sender.smtpUser,
        pass: sender.smtpPass,
      },
    });

    const info = await transporter.sendMail({
      from: `"${sender.name}" <${sender.email}>`,
      to: recipientEmail,
      subject,
      text: body.replace(/<[^>]+>/g, ''),
      html: `<div style="font-family: Inter, sans-serif; line-height: 1.6; color: #111827;">${body.replace(
        /\n/g,
        '<br/>'
      )}</div>`,
    });

    const rawPreview = nodemailer.getTestMessageUrl(info);
    const previewUrl = typeof rawPreview === 'string' ? rawPreview : null;

    console.log(
      `📧 [SMTP] Sent email from ${sender.email} -> ${recipientEmail} | MessageID: ${info.messageId} | Preview: ${previewUrl || 'N/A'}`
    );

    return {
      messageId: info.messageId,
      previewUrl,
    };
  }
}

export const smtpService = new SmtpService();
