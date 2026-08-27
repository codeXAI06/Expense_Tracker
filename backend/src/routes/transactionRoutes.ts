import { Router } from 'express';
import { z } from 'zod';
import { protect, type AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../utils/appError.js';
import {
  createTransactionForUser,
  deleteTransactionForUser,
  getTransactionByIdForUser,
  getTransactionSummaryForUser,
  getTransactionsForUser,
  updateTransactionForUser
} from '../services/transactionService.js';

const router = Router();

const transactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.number().positive(),
  description: z.string().trim().min(2).max(250),
  category: z.string().trim().min(1).max(100),
  paymentMethod: z.string().trim().min(1).max(100),
  merchant: z.string().trim().min(1).max(150).optional(),
  date: z.string().datetime().optional()
});

const updateSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  amount: z.number().positive().optional(),
  description: z.string().trim().min(2).max(250).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  paymentMethod: z.string().trim().min(1).max(100).optional(),
  merchant: z.string().trim().min(1).max(150).optional(),
  date: z.string().datetime().optional()
});

const listQuerySchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  category: z.string().trim().max(100).optional(),
  paymentMethod: z.string().trim().max(100).optional(),
  search: z.string().trim().max(200).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sort: z.enum(['date:asc', 'date:desc', 'amount:asc', 'amount:desc']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10)
});

router.use(protect);

router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const result = await getTransactionsForUser(req.user!.id, query);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/summary', async (req: AuthenticatedRequest, res, next) => {
  try {
    const month = typeof req.query.month === 'string' ? req.query.month : new Date().toISOString().slice(0, 7);
    const summary = await getTransactionSummaryForUser(req.user!.id, month);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

router.get('/:transactionId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const transactionId = Array.isArray(req.params.transactionId) ? req.params.transactionId[0] : req.params.transactionId;
    const result = await getTransactionByIdForUser(req.user!.id, transactionId);
    res.json({ transaction: result });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = transactionSchema.parse(req.body);
    const transaction = await createTransactionForUser(req.user!.id, parsed as any);
    res.status(201).json({ transaction });
  } catch (error) {
    next(error);
  }
});

router.patch('/:transactionId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = updateSchema.parse(req.body);
    if (Object.keys(parsed).length === 0) {
      throw new AppError('At least one field must be provided for update', 400);
    }

    const transactionId = Array.isArray(req.params.transactionId) ? req.params.transactionId[0] : req.params.transactionId;
    const transaction = await updateTransactionForUser(req.user!.id, transactionId, parsed as any);
    res.json({ transaction });
  } catch (error) {
    next(error);
  }
});

router.delete('/:transactionId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const transactionId = Array.isArray(req.params.transactionId) ? req.params.transactionId[0] : req.params.transactionId;
    const result = await deleteTransactionForUser(req.user!.id, transactionId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
