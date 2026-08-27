import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IReceiptConfirmation extends Document {
  user: mongoose.Types.ObjectId;
  merchant: string;
  amount: number;
  date: Date;
  category: string;
  subcategory?: string;
  source: "ocr" | "manual" | "ai";
  currency: string;
  subtotal?: number;
  tax?: number;
  discount?: number;
  paymentMethod?: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice?: number | null;
    totalPrice?: number | null;
    category?: string;
    confidence?: number;
  }>;
  receiptHash?: string;
  originalFileName?: string;
  fileReference?: string;
  rawOcrText?: string;
  extractionConfidence?: number;
  validationFlags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const receiptConfirmationSchema = new Schema<IReceiptConfirmation>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    merchant: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    category: { type: String, required: true, trim: true },
    subcategory: { type: String, trim: true },
    source: { type: String, enum: ["ocr", "manual", "ai"], required: true },
    currency: { type: String, required: true, default: "INR" },
    subtotal: { type: Number, min: 0 },
    tax: { type: Number, min: 0 },
    discount: { type: Number, min: 0 },
    paymentMethod: { type: String, trim: true },
    items: {
      type: [
        {
          name: { type: String, required: true },
          quantity: { type: Number, required: true },
          unitPrice: { type: Number },
          totalPrice: { type: Number },
          category: { type: String },
          confidence: { type: Number },
        },
      ],
      default: [],
    },
    receiptHash: { type: String, index: true },
    originalFileName: { type: String, trim: true },
    fileReference: { type: String, trim: true },
    rawOcrText: { type: String },
    extractionConfidence: { type: Number, min: 0, max: 1 },
    validationFlags: { type: [String], default: [] },
  },
  { timestamps: true },
);

const ReceiptConfirmation: Model<IReceiptConfirmation> =
  mongoose.models.ReceiptConfirmation ||
  mongoose.model<IReceiptConfirmation>(
    "ReceiptConfirmation",
    receiptConfirmationSchema,
  );

export default ReceiptConfirmation;
