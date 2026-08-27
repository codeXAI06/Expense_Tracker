import Transaction from '../models/Transaction.js';

export async function buildMonthlyReportForUser(userId: string, month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999));

  const transactions = await Transaction.find({ user: userId, date: { $gte: start, $lte: end } }).lean();
  const totalIncome = transactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpenses = transactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
  const byCategory: Record<string, number> = {};
  for (const tx of transactions.filter((item) => item.type === 'expense')) {
    byCategory[tx.category] = (byCategory[tx.category] ?? 0) + tx.amount;
  }

  const insights = [
    `Your income for this month totaled ${totalIncome.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.`,
    `Your total expenses were ${totalExpenses.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.`,
    `Largest category: ${Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'No category data'}.`
  ];

  return {
    month,
    summary: {
      totalIncome,
      totalExpenses,
      net: totalIncome - totalExpenses
    },
    insights,
    byCategory
  };
}
