import { Router } from 'express';
import { senderController } from '../controllers/sender.controller';

export const senderRouter = Router();

senderRouter.get('/', (req, res) => senderController.listSenders(req, res));
senderRouter.post('/', (req, res) => senderController.createSender(req, res));

