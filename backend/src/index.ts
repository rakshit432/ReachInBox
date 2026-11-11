import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { db } from './db';
import { elasticsearchService } from './services/elasticsearch.service';
import { emailQueueManager } from './queue';
import { apiRouter } from './routes';

async function bootstrap() {
  const app = express();

  const allowedOrigins = new Set([
    env.FRONTEND_URL.replace(/\/+$/, ''),
    'http://localhost:5173',
    'http://localhost:3000',
  ]);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const normalized = origin.replace(/\/+$/, '');
        if (
          allowedOrigins.has(normalized) ||
          normalized.endsWith('.vercel.app')
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));

  // Initialize Relational Database (Prisma ORM)
  await db.init();

  // Initialize Elasticsearch Indexing & Search Engine
  await elasticsearchService.init();

  // Initialize BullMQ Queue, Worker, Rate Limiter & Crash Recovery
  await emailQueueManager.init();

  // Mount Live BullMQ Queue Visibility Dashboard
  app.use('/admin/queues', emailQueueManager.getBullBoardRouter());

  // Mount REST API Routes
  app.use('/api', apiRouter);

  app.listen(env.PORT, () => {
    console.log('==========================================================');
    console.log(`🚀 ReachInbox Email Scheduler Backend running on port ${env.PORT}`);
    console.log(`📊 Live BullMQ Queue Dashboard: http://localhost:${env.PORT}/admin/queues`);
    console.log(`🏥 Health & Config Check:       http://localhost:${env.PORT}/api/health`);
    console.log('==========================================================');
  });
}

bootstrap().catch((err) => {
  console.error('❌ Fatal error during server bootstrap:', err);
  process.exit(1);
});
