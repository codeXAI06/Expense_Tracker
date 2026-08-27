import Transaction from '../models/Transaction.js';
import { formatRupees } from '../utils/currency.js';
import { AppError } from '../utils/appError.js';

export interface SpendingSummaryResult {
  month: string;
  totalExpenses: number;
  totalIncome: number;
  net: number;
  transactionCount: number;
  byCategory: Record<string, number>;
  trend: {
    previousMonth: number;
    currentMonth: number;
    delta: number;
    deltaPercent: number;
  };
  averageDailySpend: number;
  topMerchant: { merchant: string; total: number } | null;
}

export async function getSpendingSummaryForUser(userId: string, month: string): Promise<SpendingSummaryResult> {
  const [year, monthIndex] = month.split('-').map(Number);
  if (!year || !monthIndex || monthIndex < 1 || monthIndex > 12) {
    throw new AppError('Month must be in YYYY-MM format', 400);
  }

  const startDate = new Date(Date.UTC(year, monthIndex - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999));

  const previousMonthStart = new Date(Date.UTC(year, monthIndex - 2, 1, 0, 0, 0, 0));
  const previousMonthEnd = new Date(Date.UTC(year, monthIndex - 1, 0, 23, 59, 59, 999));

  const [current, previous] = await Promise.all([
    Transaction.find({ user: userId, date: { $gte: startDate, $lte: endDate } }),
    Transaction.find({ user: userId, date: { $gte: previousMonthStart, $lte: previousMonthEnd } })
  ]);

  const totalExpenses = current.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
  const totalIncome = current.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);

  const byCategory: Record<string, number> = {};
  for (const tx of current.filter((item) => item.type === 'expense')) {
    byCategory[tx.category] = (byCategory[tx.category] ?? 0) + tx.amount;
  }

  const previousExpenses = previous.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
  const delta = totalExpenses - previousExpenses;
  const deltaPercent = previousExpenses === 0 ? (totalExpenses > 0 ? 100 : 0) : (delta / previousExpenses) * 100;

  const merchantTotals: Record<string, number> = {};
  for (const tx of current.filter((item) => item.type === 'expense')) {
    const merchant = tx.merchant || 'Unknown Merchant';
    merchantTotals[merchant] = (merchantTotals[merchant] ?? 0) + tx.amount;
  }

  const topMerchant = Object.entries(merchantTotals).sort((a, b) => b[1] - a[1])[0];
  const daysInMonth = new Date(year, monthIndex, 0).getDate();

  return {
    month,
    totalExpenses,
    totalIncome,
    net: totalIncome - totalExpenses,
    transactionCount: current.length,
    byCategory,
    trend: {
      previousMonth: previousExpenses,
      currentMonth: totalExpenses,
      delta,
      deltaPercent: Number(deltaPercent.toFixed(1))
    },
    averageDailySpend: Number((totalExpenses / daysInMonth).toFixed(2)),
    topMerchant: topMerchant ? { merchant: topMerchant[0], total: topMerchant[1] } : null
  };
}

export async function getSpendingInsightsForUser(userId: string, month: string) {
  const summary = await getSpendingSummaryForUser(userId, month);
  const [topCategory, topCategoryValue] = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1])[0] ?? ['Miscellaneous', 0];
  const biggestExpense = (await Transaction.find({ user: userId, type: 'expense', date: { $gte: new Date(`${month}-01T00:00:00.000Z`), $lt: new Date(`${month}-31T23:59:59.999Z`) } }).sort({ amount: -1 }).limit(1).lean())[0];

  const insights = [
    `Your largest spending category is ${topCategory} at ${formatRupees(topCategoryValue)}.`,
    `Your average daily spend is ${formatRupees(summary.averageDailySpend)}.`,
    summary.trend.delta >= 0
      ? `Spending is ${summary.trend.deltaPercent.toFixed(1)}% higher than last month.`
      : `Spending is ${Math.abs(summary.trend.deltaPercent).toFixed(1)}% lower than last month.`
  ];

  return {
    month,
    topCategory,
    biggestExpense: biggestExpense
      ? {
          merchant: biggestExpense.merchant ?? 'Unknown Merchant',
          amount: biggestExpense.amount,
          category: biggestExpense.category,
          date: new Date(biggestExpense.date).toISOString()
        }
      : null,
    insights,
    summary: `You spent ${formatRupees(summary.totalExpenses)} this month, with ${topCategory} as the largest category.`,
    totalExpenses: summary.totalExpenses,
    averageDailySpend: summary.averageDailySpend,
    byCategory: summary.byCategory
  };
}
