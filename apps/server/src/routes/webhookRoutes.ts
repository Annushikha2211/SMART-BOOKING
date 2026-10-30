
import { Router } from 'express';
import express from 'express';
import { handlestripeWebhook } from '../controllers/webhookController';

const router = Router();

router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  handlestripeWebhook
);

export default router;
