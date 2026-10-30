import { Router } from 'express';
import { manualReleaseSeats } from '../controllers/adminController';

const router = Router();

// Admin guard middleware yahan laga sakte hain
router.post('/release-seats', manualReleaseSeats);

export default router;