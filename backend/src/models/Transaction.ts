import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface ITransaction extends Document {
  user: mongoose.Types.ObjectId;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  paymentMethod: string;
  merchant?: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['income', 'expense', 'transfer'], required: true, index: true },
    amount: { type: Number, required: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    paymentMethod: { type: String, required: true, trim: true },
    merchant: { type: String, trim: true },
    date: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, type: 1, category: 1, date: -1 });

const Transaction: Model<ITransaction> = mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', transactionSchema);

export default Transaction;
