import { Router } from 'express';
import { z } from 'zod';
import { protect, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  categorizeTransactionForUser,
  saveCategoryCorrectionForUser
} from '../services/aiCategorizationService.js';

const router = Router();

const categorizeSchema = z.object({
  merchant: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(250).optional(),
  amount: z.number().finite().optional(),
  history: z.array(
    z.object({
      merchant: z.string().trim().max(200).optional(),
      category: z.string().trim().max(100).optional(),
      subcategory: z.string().trim().max(100).optional()
    })
  ).default([])
});

const correctSchema = z.object({
  merchant: z.string().trim().min(1).max(200),
  originalCategory: z.string().trim().max(100).optional(),
  correctedCategory: z.string().trim().min(1).max(100),
  correctedSubcategory: z.string().trim().max(100).optional(),
  reason: z.string().trim().min(4).max(500).optional()
});

router.use(protect);

router.post('/categorize', async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = categorizeSchema.parse(req.body);
    const result = await categorizeTransactionForUser(req.user!.id, parsed);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/correct', async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = correctSchema.parse(req.body);
    const correction = await saveCategoryCorrectionForUser(req.user!.id, parsed);
    res.status(201).json({
      success: true,
      correction
    });
  } catch (error) {
    next(error);
  }
});

export default router;
