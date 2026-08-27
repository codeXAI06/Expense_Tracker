import { Router } from 'express';
import { z } from 'zod';
import { protect, type AuthenticatedRequest } from '../middleware/auth.js';
import { getSpendingInsightsForUser, getSpendingSummaryForUser } from '../services/spendingIntelligenceService.js';

const router = Router();

const monthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional()
});

router.use(protect);

router.get('/spending/summary', async (req: AuthenticatedRequest, res, next) => {
  try {
    const month = monthSchema.parse({ month: req.query.month }).month ?? new Date().toISOString().slice(0, 7);
    const summary = await getSpendingSummaryForUser(req.user!.id, month);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

router.get('/spending/insights', async (req: AuthenticatedRequest, res, next) => {
  try {
    const month = monthSchema.parse({ month: req.query.month }).month ?? new Date().toISOString().slice(0, 7);
    const insights = await getSpendingInsightsForUser(req.user!.id, month);
    res.json(insights);
  } catch (error) {
    next(error);
  }
});

export default router;
