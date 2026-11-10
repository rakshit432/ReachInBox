import { Queue } from 'bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Router } from 'express';
import { EmailQueuePayload } from '../../types';

/**
 * Queue Submodule: Live BullMQ Dashboard (/admin/queues)
 * - Mounts @bull-board/express for real-time queue visibility.
 */
export class BullBoardDashboardManager {
  private bullBoardAdapter: ExpressAdapter;

  constructor() {
    this.bullBoardAdapter = new ExpressAdapter();
    this.bullBoardAdapter.setBasePath('/admin/queues');
  }

  public attachQueue(queue: Queue<EmailQueuePayload>): void {
    createBullBoard({
      queues: [new BullMQAdapter(queue) as any],
      serverAdapter: this.bullBoardAdapter,
    });
  }

  public getRouter(): Router {
    return this.bullBoardAdapter.getRouter();
  }
}

export const bullBoardDashboard = new BullBoardDashboardManager();
