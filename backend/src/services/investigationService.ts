import Transaction from '../models/Transaction.js';

export async function getInvestigationSummaryForUser(userId: string, month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999));

  const transactions = await Transaction.find({ user: userId, type: 'expense', date: { $gte: start, $lte: end } }).lean();
  const findings = transactions
    .filter((tx) => tx.amount >= 1500)
    .map((tx) => ({
      merchant: tx.merchant || 'Unknown Merchant',
      amount: tx.amount,
      category: tx.category,
      date: new Date(tx.date).toISOString(),
      reason: `This transaction is materially above the user’s usual spending pattern and deserves review.`
    }));

  const highRisk = findings.length >= 2 ? 'high' : findings.length === 1 ? 'medium' : 'low';

  return {
    summary: {
      totalFindings: findings.length,
      highRisk,
      totalFlaggedAmount: findings.reduce((sum, item) => sum + item.amount, 0)
    },
    findings
  };
}
