import { Router } from 'express';
import { z } from 'zod';
import { protect, type AuthenticatedRequest } from '../middleware/auth.js';
import { createGoalForUser, deleteGoalForUser, getGoalsForUser, getGoalSummaryForUser, updateGoalForUser } from '../services/goalService.js';
import { simulateScenarioForUser } from '../services/scenarioService.js';
import { getInvestigationSummaryForUser } from '../services/investigationService.js';
import { answerFinancialQuestionForUser } from '../services/assistantService.js';
import { buildMonthlyReportForUser } from '../services/reportService.js';
import { AppError } from '../utils/appError.js';

const router = Router();

const goalSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(['savings', 'debt', 'investment', 'custom']),
  targetAmount: z.number().positive(),
  currentAmount: z.number().min(0),
  category: z.string().trim().min(1).max(100),
  dueDate: z.string().min(1)
});

const goalUpdateSchema = goalSchema.partial();

const scenarioSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  category: z.string().trim().min(1),
  reductionPercent: z.number().min(1).max(100),
  newPriority: z.string().trim().min(1)
});

const chatSchema = z.object({
  message: z.string().trim().min(1).max(500)
});

router.use(protect);

router.get('/goals', async (req: AuthenticatedRequest, res, next) => {
  try {
    const goals = await getGoalsForUser(req.user!.id);
    res.json({ goals });
  } catch (error) {
    next(error);
  }
});

router.get('/goals/summary', async (req: AuthenticatedRequest, res, next) => {
  try {
    const summary = await getGoalSummaryForUser(req.user!.id);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

router.post('/goals', async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = goalSchema.parse(req.body);
    const goal = await createGoalForUser(req.user!.id, parsed);
    res.status(201).json({ goal });
  } catch (error) {
    next(error);
  }
});

router.patch('/goals/:goalId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = goalUpdateSchema.parse(req.body);
    if (Object.keys(parsed).length === 0) {
      throw new AppError('At least one field must be provided for update', 400);
    }

    const goalId = Array.isArray(req.params.goalId) ? req.params.goalId[0] : req.params.goalId;
    const goal = await updateGoalForUser(req.user!.id, goalId, parsed);
    res.json({ goal });
  } catch (error) {
    next(error);
  }
});

router.delete('/goals/:goalId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const goalId = Array.isArray(req.params.goalId) ? req.params.goalId[0] : req.params.goalId;
    const result = await deleteGoalForUser(req.user!.id, goalId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/scenarios/what-if', async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = scenarioSchema.parse(req.body);
    const result = await simulateScenarioForUser(req.user!.id, parsed.month, parsed.category, parsed.reductionPercent, parsed.newPriority);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/investigations/spending', async (req: AuthenticatedRequest, res, next) => {
  try {
    const month = typeof req.query.month === 'string' ? req.query.month : new Date().toISOString().slice(0, 7);
    const result = await getInvestigationSummaryForUser(req.user!.id, month);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/assistant/chat', async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = chatSchema.parse(req.body);
    const answer = await answerFinancialQuestionForUser(req.user!.id, parsed.message);
    res.json(answer);
  } catch (error) {
    next(error);
  }
});

router.get('/reports/monthly', async (req: AuthenticatedRequest, res, next) => {
  try {
    const month = typeof req.query.month === 'string' ? req.query.month : new Date().toISOString().slice(0, 7);
    const report = await buildMonthlyReportForUser(req.user!.id, month);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

export default router;
