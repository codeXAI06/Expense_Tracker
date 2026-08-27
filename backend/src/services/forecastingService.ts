import Transaction from '../models/Transaction.js';

export interface ForecastResult {
  month: string;
  nextMonthCashFlow: number;
  burnRate: number;
  projectedSavings: number;
  recommendedActions: string[];
  riskSummary: string;
  assumptions: string[];
}

export async function getForecastForUser(userId: string, month: string): Promise<ForecastResult> {
  const [year, monthIndex] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999));

  const transactions = await Transaction.find({ user: userId, date: { $gte: start, $lte: end } }).lean();
  const income = transactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  const expenses = transactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);

  const averageMonthlyExpense = expenses > 0 ? expenses / 1 : 0;
  const projectedExpense = averageMonthlyExpense * 1.05;
  const projectedIncome = income > 0 ? income * 0.98 : 0;
  const nextMonthCashFlow = projectedIncome - projectedExpense;
  const burnRate = expenses > 0 ? expenses / Math.max(income, 1) : 0;
  const projectedSavings = Math.max(nextMonthCashFlow, 0);

  let riskSummary = 'stable';
  if (nextMonthCashFlow < 0 || burnRate > 0.45) {
    riskSummary = 'watch';
  }
  if (nextMonthCashFlow < -2000 || burnRate > 0.6) {
    riskSummary = 'risk';
  }

  const recommendedActions = [] as string[];
  if (nextMonthCashFlow < 0) {
    recommendedActions.push('Reduce discretionary spending and pause non-essential subscriptions.');
  }
  if (projectedExpense > projectedIncome * 0.7) {
    recommendedActions.push('Review recurring categories to reduce spend before the next cycle.');
  }
  if (projectedSavings > 0) {
    recommendedActions.push('Allocate a percentage of projected savings to emergency reserves.');
  }

  if (recommendedActions.length === 0) {
    recommendedActions.push('Keep current spending pace and maintain your savings target.');
  }

  return {
    month,
    nextMonthCashFlow: Number(nextMonthCashFlow.toFixed(2)),
    burnRate: Number(burnRate.toFixed(4)),
    projectedSavings: Number(projectedSavings.toFixed(2)),
    recommendedActions,
    riskSummary,
    assumptions: [
      'Income remains consistent with the current month.',
      'Expense trends continue without major one-off spikes.',
      'No large seasonal or irregular costs are added in the next cycle.'
    ]
  };
}
