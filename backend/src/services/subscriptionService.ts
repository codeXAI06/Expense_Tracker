import { AppError } from '../utils/appError.js';
import Subscription, { type SubscriptionCadence, type SubscriptionStatus } from '../models/Subscription.js';

export interface CreateSubscriptionInput {
  name: string;
  merchant: string;
  amount: number;
  category: string;
  cadence: SubscriptionCadence;
  nextBillingDate: string;
  status?: SubscriptionStatus;
}

export async function createSubscriptionForUser(userId: string, payload: CreateSubscriptionInput) {
  const validCadence = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;
  if (!validCadence.includes(payload.cadence)) {
    throw new AppError('Invalid cadence. Choose weekly, monthly, quarterly, or yearly.', 400);
  }

  const subscription = await Subscription.create({
    user: userId,
    name: payload.name,
    merchant: payload.merchant,
    amount: Number(payload.amount),
    category: payload.category,
    cadence: payload.cadence,
    nextBillingDate: new Date(payload.nextBillingDate),
    status: payload.status ?? 'active'
  });

  return {
    id: String(subscription._id),
    user: String(subscription.user),
    name: subscription.name,
    merchant: subscription.merchant,
    amount: subscription.amount,
    category: subscription.category,
    cadence: subscription.cadence,
    nextBillingDate: new Date(subscription.nextBillingDate).toISOString().slice(0, 10),
    status: subscription.status
  };
}

export async function getSubscriptionsForUser(userId: string) {
  const subscriptions = await Subscription.find({ user: userId }).sort({ nextBillingDate: 1 }).lean();

  return subscriptions.map((subscription) => ({
    id: String(subscription._id),
    user: String(subscription.user),
    name: subscription.name,
    merchant: subscription.merchant,
    amount: subscription.amount,
    category: subscription.category,
    cadence: subscription.cadence,
    nextBillingDate: new Date(subscription.nextBillingDate).toISOString().slice(0, 10),
    status: subscription.status
  }));
}

export async function getSubscriptionSummaryForUser(userId: string) {
  const subscriptions = await Subscription.find({ user: userId, status: 'active' }).lean();

  const totalMonthlySpend = subscriptions.reduce((sum, sub) => {
    const multiplier = sub.cadence === 'weekly' ? 4.33 : sub.cadence === 'monthly' ? 1 : sub.cadence === 'quarterly' ? 1 / 3 : 1 / 12;
    return sum + sub.amount * multiplier;
  }, 0);

  const byCategory: Record<string, number> = {};
  for (const sub of subscriptions) {
    byCategory[sub.category] = (byCategory[sub.category] ?? 0) + sub.amount;
  }

  return {
    activeCount: subscriptions.length,
    totalMonthlySpend: Number(totalMonthlySpend.toFixed(2)),
    byCategory,
    nextRenewals: subscriptions
      .sort((a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime())
      .slice(0, 5)
      .map((sub) => ({
        name: sub.name,
        merchant: sub.merchant,
        date: new Date(sub.nextBillingDate).toISOString().slice(0, 10)
      }))
  };
}
