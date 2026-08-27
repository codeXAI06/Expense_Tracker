import Transaction from '../models/Transaction.js';

export interface AnomalyAlert {
  type: string;
  amount: number;
  merchant: string;
  category: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

export async function getAnomalyAlertsForUser(userId: string, month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999));

  const transactions = await Transaction.find({ user: userId, type: 'expense', date: { $gte: start, $lte: end } }).lean();

  if (transactions.length === 0) {
    return {
      anomalies: [],
      summary: {
        totalAnomalies: 0,
        riskLevel: 'low',
        highestImpact: 0
      }
    };
  }

  const amounts = transactions.map((tx) => tx.amount).sort((a, b) => a - b);
  const median = amounts[Math.floor(amounts.length / 2)] ?? 0;
  const threshold = median * 2.5;

  const anomalies: AnomalyAlert[] = transactions
    .filter((tx) => tx.amount >= threshold || tx.amount >= 1500)
    .map((tx) => {
      const severity = tx.amount >= 2500 ? 'high' : tx.amount >= 1500 ? 'medium' : 'low';
      return {
        type: tx.amount >= 2500 ? 'large-spend-spike' : 'outlier-expense',
        amount: tx.amount,
        merchant: tx.merchant || 'Unknown Merchant',
        category: tx.category,
        reason: tx.amount >= 2500
          ? `This expense is unusually high compared with the user’s typical spend pattern for this month.`
          : `This expense is materially above the median spend and may represent an outlier purchase.`,
        severity
      };
    });

  const riskLevel = anomalies.some((a) => a.severity === 'high') ? 'high' : anomalies.some((a) => a.severity === 'medium') ? 'medium' : 'low';

  return {
    anomalies,
    summary: {
      totalAnomalies: anomalies.length,
      riskLevel,
      highestImpact: anomalies.reduce((max, anomaly) => Math.max(max, anomaly.amount), 0)
    }
  };
}
