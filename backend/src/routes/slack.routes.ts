import { Router } from 'express';
import { slackController } from '../controllers/slack.controller';

export const slackRouter = Router();

slackRouter.get('/oauth/start', (req, res) =>
  slackController.startOAuth(req, res)
);
slackRouter.get('/oauth/callback', (req, res) =>
  slackController.oauthCallback(req, res)
);
slackRouter.post('/disconnect', (req, res) =>
  slackController.disconnect(req, res)
);
