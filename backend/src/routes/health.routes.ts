import { Router } from 'express';
import { env } from '../config/env';
import { elasticsearchService } from '../services/elasticsearch.service';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      workerConcurrency: env.WORKER_CONCURRENCY,
      minDelayBetweenEmailsMs: env.MIN_DELAY_BETWEEN_EMAILS_MS,
      maxEmailsPerHourPerSender: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
      elasticsearch: elasticsearchService.getStatus(),
      bullBoardUrl: `http://localhost:${env.PORT}/admin/queues`,
    },
  });
});

