import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IGoal extends Document {
  user: mongoose.Types.ObjectId;
  name: string;
  type: 'savings' | 'debt' | 'investment' | 'custom';
  targetAmount: number;
  currentAmount: number;
  category: string;
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const goalSchema = new Schema<IGoal>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['savings', 'debt', 'investment', 'custom'], required: true },
    targetAmount: { type: Number, required: true },
    currentAmount: { type: Number, required: true, default: 0 },
    category: { type: String, required: true, trim: true },
    dueDate: { type: Date, required: true }
  },
  { timestamps: true }
);

const Goal: Model<IGoal> = mongoose.models.Goal || mongoose.model<IGoal>('Goal', goalSchema);

export default Goal;
