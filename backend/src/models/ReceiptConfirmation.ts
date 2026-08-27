import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IReceiptConfirmation extends Document {
  user: mongoose.Types.ObjectId;
  merchant: string;
  amount: number;
  date: Date;
  category: string;
  subcategory?: string;
  source: 'ocr' | 'manual' | 'ai';
  createdAt: Date;
  updatedAt: Date;
}

const receiptConfirmationSchema = new Schema<IReceiptConfirmation>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    merchant: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    category: { type: String, required: true, trim: true },
    subcategory: { type: String, trim: true },
    source: { type: String, enum: ['ocr', 'manual', 'ai'], required: true }
  },
  { timestamps: true }
);

const ReceiptConfirmation: Model<IReceiptConfirmation> =
  mongoose.models.ReceiptConfirmation || mongoose.model<IReceiptConfirmation>('ReceiptConfirmation', receiptConfirmationSchema);

export default ReceiptConfirmation;
