import { Router } from 'express';
import { authRouter } from './auth.routes';
import { emailRouter } from './email.routes';
import { senderRouter } from './sender.routes';
import { slackRouter } from './slack.routes';
import { healthRouter } from './health.routes';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/emails', emailRouter);
apiRouter.use('/senders', senderRouter);
apiRouter.use('/slack', slackRouter);

