import { Router } from 'express';
import { z } from 'zod';
import { protect, type AuthenticatedRequest } from '../middleware/auth.js';
import { getAnomalyAlertsForUser } from '../services/anomalyDetectionService.js';

const router = Router();

const monthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional()
});

router.use(protect);

router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const month = monthSchema.parse({ month: req.query.month }).month ?? new Date().toISOString().slice(0, 7);
    const result = await getAnomalyAlertsForUser(req.user!.id, month);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
