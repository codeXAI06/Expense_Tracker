import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IAICorrection extends Document {
  user: mongoose.Types.ObjectId;
  merchant: string;
  normalizedMerchant: string;
  originalCategory?: string;
  correctedCategory: string;
  correctedSubcategory?: string;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const aiCorrectionSchema = new Schema<IAICorrection>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    merchant: { type: String, required: true, trim: true },
    normalizedMerchant: { type: String, required: true, trim: true, index: true },
    originalCategory: { type: String, trim: true },
    correctedCategory: { type: String, required: true, trim: true },
    correctedSubcategory: { type: String, trim: true },
    reason: { type: String, trim: true }
  },
  { timestamps: true }
);

aiCorrectionSchema.index({ user: 1, normalizedMerchant: 1 }, { unique: true });

const AICorrection: Model<IAICorrection> =
  mongoose.models.AICorrection || mongoose.model<IAICorrection>('AICorrection', aiCorrectionSchema);

export default AICorrection;
