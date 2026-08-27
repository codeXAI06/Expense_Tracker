import Transaction from '../models/Transaction.js';
import Goal from '../models/Goal.js';
import { formatRupees } from '../utils/currency.js';

function formatMoney(amount: number) {
  return formatRupees(amount);
}

function isFoodTransaction(category: string, merchant?: string) {
  return /food|dining|coffee|restaurant|lunch|dinner|meal/i.test(`${category} ${merchant ?? ''}`);
}

export async function answerFinancialQuestionForUser(userId: string, message: string) {
  const lower = message.toLowerCase();
  const transactions = await Transaction.find({ user: userId, type: 'expense' }).sort({ date: -1 }).lean();
  const allTransactions = await Transaction.find({ user: userId }).sort({ date: -1 }).lean();

  if (transactions.length === 0) {
    return {
      answer: 'I do not have enough transaction history to answer that yet.',
      recommendations: ['Add a few income and expense transactions, then ask again.'],
      categoryFocus: 'Insufficient data'
    };
  }

  const foodSpend = transactions.filter((tx) => isFoodTransaction(tx.category, tx.merchant)).reduce((sum, tx) => sum + tx.amount, 0);
  const largest = [...transactions].sort((a, b) => b.amount - a.amount).slice(0, 5);

  if (/(food|coffee|restaurant|meal|eat)/i.test(lower)) {
    return {
      answer: `Your recorded food and dining spend is ${formatMoney(foodSpend)} across ${transactions.filter((tx) => isFoodTransaction(tx.category, tx.merchant)).length} transactions.`,
      recommendations: [
      'Set a weekly dining cap and keep it under the current average.',
      'Plan meals around home cooking to reduce restaurant and delivery costs.',
      'Review the categories with repeated delivery or coffee purchases and batch them into one weekly spend window.'
      ],
      categoryFocus: 'Food & Dining'
    };
  }

  if (/(biggest|largest|top).*(expense|spend|purchase)/i.test(lower)) {
    return {
      answer: `Your largest recorded expenses are ${largest.map((tx) => `${tx.merchant || tx.description} (${formatMoney(tx.amount)})`).join(', ')}.`,
      recommendations: ['Review the largest expense against your budget and goals before repeating it.'],
      categoryFocus: 'Largest expenses'
    };
  }

  if (/(goal|saving progress|progress toward)/i.test(lower)) {
    const goals = await Goal.find({ user: userId }).sort({ dueDate: 1 }).lean();
    if (goals.length === 0) {
      return { answer: 'I do not have a financial goal recorded for you yet.', recommendations: ['Create a goal to track progress toward a target.'], categoryFocus: 'Goals' };
    }
    const goal = goals[0];
    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
    return { answer: `${goal.name} is ${progress.toFixed(1)}% funded: ${formatMoney(goal.currentAmount)} of ${formatMoney(goal.targetAmount)}.`, recommendations: ['Keep contributions consistent with the goal deadline.'], categoryFocus: 'Goals' };
  }

  if (/(compare|more|less).*(month|spend)/i.test(lower)) {
    const latestMonth = new Date(allTransactions[0].date);
    const currentStart = new Date(Date.UTC(latestMonth.getUTCFullYear(), latestMonth.getUTCMonth(), 1));
    const previousStart = new Date(Date.UTC(latestMonth.getUTCFullYear(), latestMonth.getUTCMonth() - 1, 1));
    const currentSpend = transactions.filter((tx) => new Date(tx.date) >= currentStart).reduce((sum, tx) => sum + tx.amount, 0);
    const previousSpend = transactions.filter((tx) => new Date(tx.date) >= previousStart && new Date(tx.date) < currentStart).reduce((sum, tx) => sum + tx.amount, 0);
    const change = previousSpend === 0 ? null : ((currentSpend - previousSpend) / previousSpend) * 100;
    return { answer: change === null ? `This month has ${formatMoney(currentSpend)} in expenses; there is not enough prior-month data for a percentage comparison.` : `Expenses changed from ${formatMoney(previousSpend)} last month to ${formatMoney(currentSpend)} this month (${change.toFixed(1)}%).`, recommendations: [], categoryFocus: 'Monthly comparison' };
  }

  return { answer: 'I do not have enough information to determine that from your transaction history.', recommendations: [], categoryFocus: 'Insufficient data' };
}
