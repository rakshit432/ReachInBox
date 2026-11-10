import { prisma } from './prisma';
import { userRepository } from './repositories/user.repository';
import { senderRepository } from './repositories/sender.repository';
import { emailJobRepository } from './repositories/emailJob.repository';
import { rateLimitRepository } from './repositories/rateLimit.repository';

class DatabaseRepository {
  async init(): Promise<void> {
    await prisma.$connect();
    console.log('✅ [Prisma DB] Connected to relational database via Prisma ORM');
  }

  // User Repository Delegation
  upsertUser = userRepository.upsertUser.bind(userRepository);
  getUserById = userRepository.getUserById.bind(userRepository);
  getUserByEmail = userRepository.getUserByEmail.bind(userRepository);
  updateUserSlackConfig =
    userRepository.updateUserSlackConfig.bind(userRepository);

  // Sender Repository Delegation
  createSenderAccount =
    senderRepository.createSenderAccount.bind(senderRepository);
  getSenderAccountsByUser =
    senderRepository.getSenderAccountsByUser.bind(senderRepository);
  getSenderAccountById =
    senderRepository.getSenderAccountById.bind(senderRepository);

  // EmailJob Repository Delegation
  createEmailJob =
    emailJobRepository.createEmailJob.bind(emailJobRepository);
  getEmailJobById =
    emailJobRepository.getEmailJobById.bind(emailJobRepository);
  updateEmailJobStatus =
    emailJobRepository.updateEmailJobStatus.bind(emailJobRepository);
  getEmailJobsByUser =
    emailJobRepository.getEmailJobsByUser.bind(emailJobRepository);
  getPendingEmailJobsForRecovery =
    emailJobRepository.getPendingEmailJobsForRecovery.bind(emailJobRepository);
  searchEmailJobsInDb =
    emailJobRepository.searchEmailJobsInDb.bind(emailJobRepository);

  // RateLimit Repository Delegation
  checkAndIncrementRateLimitInDb =
    rateLimitRepository.checkAndIncrementRateLimitInDb.bind(
      rateLimitRepository
    );
}

export const db = new DatabaseRepository();
export {
  userRepository,
  senderRepository,
  emailJobRepository,
  rateLimitRepository,
};
