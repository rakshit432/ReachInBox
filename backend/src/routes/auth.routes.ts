import { Router } from 'express';
import { authController } from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.post('/google', (req, res) => authController.googleLogin(req, res));
authRouter.get('/me', (req, res) => authController.getMe(req, res));

