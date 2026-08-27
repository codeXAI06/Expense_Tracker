import Transaction from '../models/Transaction.js';

export async function answerFinancialQuestionForUser(userId: string, message: string) {
  const lower = message.toLowerCase();
  const transactions = await Transaction.find({ user: userId, type: 'expense' }).sort({ amount: -1 }).limit(5).lean();

  const foodSpend = transactions.filter((tx) => /food|coffee|restaurant|lunch|dinner|zomato|starbucks/i.test(tx.category) || /food|coffee|restaurant|zomato|starbucks/i.test(tx.merchant ?? '')).reduce((sum, tx) => sum + tx.amount, 0);

  let answer = 'Your current spending is trending in a healthy range. Keep monitoring discretionary categories and redirect extra cash toward savings.';
  let recommendations = ['Review recurring subscriptions for non-essential services.', 'Use a weekly grocery cap to reduce impulse food purchases.'];

  if (foodSpend > 0 && /(food|coffee|restaurant|meal|eat)/i.test(lower)) {
    answer = `Food and dining is one of your larger spending areas. You are currently at about ${foodSpend.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} in recent discretionary food spend.`;
    recommendations = [
      'Set a weekly dining cap and keep it under the current average.',
      'Plan meals around home cooking to reduce restaurant and delivery costs.',
      'Review the categories with repeated delivery or coffee purchases and batch them into one weekly spend window.'
    ];
  }

  return {
    answer,
    recommendations,
    categoryFocus: foodSpend > 0 ? 'Food & Dining' : 'General spending'
  };
}
