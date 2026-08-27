import Transaction from '../models/Transaction.js';

export async function simulateScenarioForUser(userId: string, month: string, category: string, reductionPercent: number, newPriority: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999));

  const transactions = await Transaction.find({ user: userId, category, type: 'expense', date: { $gte: start, $lte: end } }).lean();
  const currentSpend = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const estimatedSavings = currentSpend * (reductionPercent / 100);
  const projectedIncome = await Transaction.find({ user: userId, type: 'income', date: { $gte: start, $lte: end } }).lean();
  const incomeTotal = projectedIncome.reduce((sum, tx) => sum + tx.amount, 0);
  const newCashFlow = incomeTotal - (currentSpend - estimatedSavings);

  return {
    estimatedSavings: Number(estimatedSavings.toFixed(2)),
    newCashFlow: Number(newCashFlow.toFixed(2)),
    recommendation: `Reducing ${category} by ${reductionPercent}% could free up ${estimatedSavings.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} to support ${newPriority}.`,
    assumptions: [
      `Current ${category} spend is ${currentSpend.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.`,
      `Projected new cash flow assumes the reduced spend is redirected into ${newPriority}.`
    ]
  };
}
