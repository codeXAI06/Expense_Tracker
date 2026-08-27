import { AppError } from '../utils/appError.js';
import Goal from '../models/Goal.js';

export interface GoalInput {
  name: string;
  type: 'savings' | 'debt' | 'investment' | 'custom';
  targetAmount: number;
  currentAmount: number;
  category: string;
  dueDate: string;
}

export async function createGoalForUser(userId: string, payload: GoalInput) {
  const goal = await Goal.create({
    user: userId,
    name: payload.name,
    type: payload.type,
    targetAmount: Number(payload.targetAmount),
    currentAmount: Number(payload.currentAmount),
    category: payload.category,
    dueDate: new Date(payload.dueDate)
  });

  const progressPercent = payload.targetAmount > 0 ? (payload.currentAmount / payload.targetAmount) * 100 : 0;

  return {
    id: String(goal._id),
    user: String(goal.user),
    name: goal.name,
    type: goal.type,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    category: goal.category,
    dueDate: new Date(goal.dueDate).toISOString().slice(0, 10),
    progress: goal.currentAmount,
    progressPercent: Number(progressPercent.toFixed(2))
  };
}

export async function getGoalsForUser(userId: string) {
  const goals = await Goal.find({ user: userId }).sort({ dueDate: 1 }).lean();

  return goals.map((goal) => ({
    id: String(goal._id),
    name: goal.name,
    type: goal.type,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    category: goal.category,
    dueDate: new Date(goal.dueDate).toISOString().slice(0, 10),
    progress: goal.currentAmount,
    progressPercent: goal.targetAmount > 0 ? Number(((goal.currentAmount / goal.targetAmount) * 100).toFixed(2)) : 0
  }));
}

export async function updateGoalForUser(userId: string, goalId: string, updates: Partial<GoalInput>) {
  const goal = await Goal.findOne({ _id: goalId, user: userId });

  if (!goal) {
    throw new AppError('Goal not found', 404);
  }

  if (updates.name !== undefined) goal.name = updates.name;
  if (updates.type !== undefined) goal.type = updates.type;
  if (updates.targetAmount !== undefined) goal.targetAmount = Number(updates.targetAmount);
  if (updates.currentAmount !== undefined) goal.currentAmount = Number(updates.currentAmount);
  if (updates.category !== undefined) goal.category = updates.category;
  if (updates.dueDate !== undefined) goal.dueDate = new Date(updates.dueDate);

  await goal.save();

  return {
    id: String(goal._id),
    user: String(goal.user),
    name: goal.name,
    type: goal.type,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    category: goal.category,
    dueDate: new Date(goal.dueDate).toISOString().slice(0, 10),
    progress: goal.currentAmount,
    progressPercent: goal.targetAmount > 0 ? Number(((goal.currentAmount / goal.targetAmount) * 100).toFixed(2)) : 0
  };
}

export async function deleteGoalForUser(userId: string, goalId: string) {
  const result = await Goal.deleteOne({ _id: goalId, user: userId });

  if (result.deletedCount === 0) {
    throw new AppError('Goal not found', 404);
  }

  return { deleted: true };
}

export async function getGoalSummaryForUser(userId: string) {
  const goals = await Goal.find({ user: userId }).lean();
  return {
    count: goals.length,
    totalTarget: goals.reduce((sum, goal) => sum + goal.targetAmount, 0),
    totalSaved: goals.reduce((sum, goal) => sum + goal.currentAmount, 0),
    goals: goals.map((goal) => ({
      id: String(goal._id),
      name: goal.name,
      progressPercent: goal.targetAmount > 0 ? Number(((goal.currentAmount / goal.targetAmount) * 100).toFixed(2)) : 0
    }))
  };
}
