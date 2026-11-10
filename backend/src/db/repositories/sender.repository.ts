import { prisma } from '../prisma';
import { SenderAccount } from '../../types';
import { mapSender } from './mappers';

export class SenderRepository {
  async createSenderAccount(sender: SenderAccount): Promise<SenderAccount> {
    const record = await prisma.senderAccount.create({
      data: {
        id: sender.id,
        userId: sender.userId,
        email: sender.email,
        name: sender.name,
        smtpHost: sender.smtpHost,
        smtpPort: sender.smtpPort,
        smtpUser: sender.smtpUser,
        smtpPass: sender.smtpPass,
        hourlyLimit: sender.hourlyLimit,
      },
    });
    return mapSender(record);
  }

  async getSenderAccountsByUser(userId: string): Promise<SenderAccount[]> {
    const rows = await prisma.senderAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r: (typeof rows)[number]) => mapSender(r));
  }

  async getSenderAccountById(id: string): Promise<SenderAccount | null> {
    const row = await prisma.senderAccount.findUnique({ where: { id } });
    return row ? mapSender(row) : null;
  }
}

export const senderRepository = new SenderRepository();

