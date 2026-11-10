import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const env = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Database
  DATABASE_URL:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/reachinbox_scheduler',

  // Redis / BullMQ
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',

  // Elasticsearch
  ELASTICSEARCH_URL: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  ELASTICSEARCH_INDEX: process.env.ELASTICSEARCH_INDEX || 'reachinbox_emails',

  // Scheduler & Throughput Controls (Configurable via env - no hardcoding)
  WORKER_CONCURRENCY: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  MIN_DELAY_BETWEEN_EMAILS_MS: parseInt(
    process.env.MIN_DELAY_BETWEEN_EMAILS_MS || '2000',
    10
  ),
  MAX_EMAILS_PER_HOUR_PER_SENDER: parseInt(
    process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '50',
    10
  ),

  // Ethereal SMTP
  ETHEREAL_HOST: process.env.ETHEREAL_HOST || 'smtp.ethereal.email',
  ETHEREAL_PORT: parseInt(process.env.ETHEREAL_PORT || '587', 10),
  ETHEREAL_USER: process.env.ETHEREAL_USER || '',
  ETHEREAL_PASS: process.env.ETHEREAL_PASS || '',

  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',

  // Slack OAuth & Webhook
  SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID || '',
  SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET || '',
  SLACK_REDIRECT_URI:
    process.env.SLACK_REDIRECT_URI ||
    'http://localhost:4000/api/slack/oauth/callback',
  SLACK_DEFAULT_WEBHOOK_URL: process.env.SLACK_DEFAULT_WEBHOOK_URL || '',
};

