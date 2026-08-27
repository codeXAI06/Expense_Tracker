import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type SubscriptionCadence = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';

export interface ISubscription extends Document {
  user: mongoose.Types.ObjectId;
  name: string;
  merchant: string;
  amount: number;
  category: string;
  cadence: SubscriptionCadence;
  nextBillingDate: Date;
  status: SubscriptionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    merchant: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true, trim: true },
    cadence: { type: String, enum: ['weekly', 'monthly', 'quarterly', 'yearly'], required: true },
    nextBillingDate: { type: Date, required: true },
    status: { type: String, enum: ['active', 'paused', 'cancelled'], default: 'active' }
  },
  { timestamps: true }
);

const Subscription: Model<ISubscription> =
  mongoose.models.Subscription || mongoose.model<ISubscription>('Subscription', subscriptionSchema);

export default Subscription;
