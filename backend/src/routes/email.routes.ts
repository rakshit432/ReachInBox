import { Router } from 'express';
import { emailController } from '../controllers/email.controller';

export const emailRouter = Router();

emailRouter.post('/schedule', (req, res) =>
  emailController.scheduleEmails(req, res)
);
emailRouter.get('/search', (req, res) =>
  emailController.searchEmails(req, res)
);
emailRouter.get('/', (req, res) => emailController.listEmails(req, res));
emailRouter.get('/:id', (req, res) => emailController.getEmailById(req, res));

