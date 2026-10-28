import { Router } from 'express';
import { holdSeats } from '../controllers/bookingController';
import { holdRateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/hold', holdRateLimiter, holdSeats);

export default router;