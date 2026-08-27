import { Router } from 'express';
import { z } from 'zod';
import { protect, type AuthenticatedRequest } from '../middleware/auth.js';
import { createSubscriptionForUser, getSubscriptionSummaryForUser, getSubscriptionsForUser } from '../services/subscriptionService.js';

const router = Router();

const subscriptionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  merchant: z.string().trim().min(1).max(200),
  amount: z.number().positive(),
  category: z.string().trim().min(1).max(100),
  cadence: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  nextBillingDate: z.string().min(1),
  status: z.enum(['active', 'paused', 'cancelled']).optional()
});

router.use(protect);

router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const subscriptions = await getSubscriptionsForUser(req.user!.id);
    res.json({ subscriptions });
  } catch (error) {
    next(error);
  }
});

router.get('/summary', async (req: AuthenticatedRequest, res, next) => {
  try {
    const summary = await getSubscriptionSummaryForUser(req.user!.id);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = subscriptionSchema.parse(req.body);
    const subscription = await createSubscriptionForUser(req.user!.id, parsed);
    res.status(201).json({ subscription });
  } catch (error) {
    next(error);
  }
});

export default router;
