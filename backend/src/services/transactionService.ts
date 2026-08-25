import type { FilterQuery, SortOrder } from 'mongoose';
import { AppError } from '../utils/appError.js';
import Transaction, { type ITransaction, type TransactionType } from '../models/Transaction.js';

export interface TransactionQueryOptions {
  type?: TransactionType;
  category?: string;
  paymentMethod?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface TransactionSummary {
  totalIncome: number;
  totalExpenses: number;
  net: number;
  transactionCount: number;
  byCategory: Record<string, number>;
}

function normalizeSort(sortValue?: string): Record<string, SortOrder> {
  if (!sortValue) {
    return { date: -1 as SortOrder };
  }

  const [field, direction] = sortValue.split(':');
  const normalizedField = field === 'amount' || field === 'date' ? field : 'date';
  const normalizedDirection = direction === 'asc' ? 1 : -1;

  return { [normalizedField]: normalizedDirection as SortOrder };
}

export async function getTransactionsForUser(userId: string, options: TransactionQueryOptions = {}) {
  const page = Number(options.page ?? 1);
  const limit = Number(options.limit ?? 10);
  const skip = (page - 1) * limit;

  const query: FilterQuery<ITransaction> = { user: userId };

  if (options.type) query.type = options.type;
  if (options.category) query.category = { $regex: options.category, $options: 'i' };
  if (options.paymentMethod) query.paymentMethod = { $regex: options.paymentMethod, $options: 'i' };
  if (options.startDate || options.endDate) {
    query.date = {} as FilterQuery<ITransaction>['date'];

    if (options.startDate) {
      query.date.$gte = new Date(options.startDate);
    }

    if (options.endDate) {
      query.date.$lte = new Date(options.endDate);
    }
  }

  if (options.search) {
    query.$or = [
      { description: { $regex: options.search, $options: 'i' } },
      { merchant: { $regex: options.search, $options: 'i' } },
      { category: { $regex: options.search, $options: 'i' } }
    ];
  }

  const [items, total] = await Promise.all([
    Transaction.find(query)
      .sort(normalizeSort(options.sort))
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(query)
  ]);

  return {
    items: items.map((item) => ({
      id: String(item._id),
      ...item,
      date: new Date(item.date).toISOString(),
      createdAt: new Date(item.createdAt).toISOString(),
      updatedAt: new Date(item.updatedAt).toISOString(),
      user: String(item.user)
    })),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1
  };
}

export async function createTransactionForUser(userId: string, payload: Partial<ITransaction>) {
  const transaction = await Transaction.create({
    ...payload,
    user: userId,
    amount: Number(payload.amount),
    date: payload.date ? new Date(payload.date) : new Date()
  });

  return {
    id: String(transaction._id),
    user: String(transaction.user),
    type: transaction.type,
    amount: transaction.amount,
    description: transaction.description,
    category: transaction.category,
    paymentMethod: transaction.paymentMethod,
    merchant: transaction.merchant,
    date: new Date(transaction.date).toISOString(),
    createdAt: new Date(transaction.createdAt).toISOString(),
    updatedAt: new Date(transaction.updatedAt).toISOString()
  };
}

export async function getTransactionByIdForUser(userId: string, transactionId: string) {
  const transaction = await Transaction.findOne({ _id: transactionId, user: userId });

  if (!transaction) {
    throw new AppError('Transaction not found', 404);
  }

  return {
    id: String(transaction._id),
    user: String(transaction.user),
    type: transaction.type,
    amount: transaction.amount,
    description: transaction.description,
    category: transaction.category,
    paymentMethod: transaction.paymentMethod,
    merchant: transaction.merchant,
    date: new Date(transaction.date).toISOString(),
    createdAt: new Date(transaction.createdAt).toISOString(),
    updatedAt: new Date(transaction.updatedAt).toISOString()
  };
}

export async function updateTransactionForUser(userId: string, transactionId: string, updates: Partial<ITransaction>) {
  const transaction = await Transaction.findOne({ _id: transactionId, user: userId });

  if (!transaction) {
    throw new AppError('Transaction not found', 404);
  }

  if (updates.amount !== undefined) {
    transaction.amount = Number(updates.amount);
  }
  if (updates.type) transaction.type = updates.type;
  if (updates.description) transaction.description = updates.description;
  if (updates.category) transaction.category = updates.category;
  if (updates.paymentMethod) transaction.paymentMethod = updates.paymentMethod;
  if (updates.merchant !== undefined) transaction.merchant = updates.merchant;
  if (updates.date) transaction.date = new Date(updates.date);

  await transaction.save();
  return getTransactionByIdForUser(userId, String(transaction._id));
}

export async function deleteTransactionForUser(userId: string, transactionId: string) {
  const result = await Transaction.deleteOne({ _id: transactionId, user: userId });

  if (result.deletedCount === 0) {
    throw new AppError('Transaction not found', 404);
  }

  return { deleted: true };
}

export async function getTransactionSummaryForUser(userId: string, month: string): Promise<TransactionSummary> {
  const [year, monthNumber] = month.split('-').map(Number);
  const startDate = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999));

  const transactions = await Transaction.find({
    user: userId,
    date: { $gte: startDate, $lte: endDate }
  });

  const totalIncome = transactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpenses = transactions
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const byCategory: Record<string, number> = {};
  for (const tx of transactions.filter((item) => item.type === 'expense')) {
    byCategory[tx.category] = (byCategory[tx.category] ?? 0) + tx.amount;
  }

  return {
    totalIncome,
    totalExpenses,
    net: totalIncome - totalExpenses,
    transactionCount: transactions.length,
    byCategory
  };
}
