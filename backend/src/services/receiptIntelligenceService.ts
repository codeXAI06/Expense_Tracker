import { extractReceiptWithOptionalLlm } from "./receiptExtractionService.js";
import { AppError } from "../utils/appError.js";
import ReceiptConfirmation from "../models/ReceiptConfirmation.js";
import Transaction from "../models/Transaction.js";
import { findReceiptDuplicate } from "./receiptDuplicateService.js";
import {
  hashReceipt,
  runReceiptOcr,
  storeOriginalReceipt,
} from "./receiptOcrService.js";
import { validateReceipt } from "./receiptValidationService.js";

export async function analyzeReceiptForUser(
  userId: string,
  fileBuffer: Buffer,
  originalFileName: string,
) {
  const receiptHash = hashReceipt(fileBuffer);
  const ocr = await runReceiptOcr(fileBuffer, originalFileName);
  const fileReference = await storeOriginalReceipt(
    fileBuffer,
    originalFileName,
    receiptHash,
  );
  const extracted = await extractReceiptWithOptionalLlm(ocr);
  const validation = validateReceipt(extracted);
  const duplicate = await findReceiptDuplicate(
    userId,
    receiptHash,
    extracted.merchant ?? undefined,
    extracted.date ?? undefined,
    extracted.total ?? undefined,
  );

  if (!extracted.merchant || extracted.total === null) {
    throw new AppError(
      "We could not read this receipt clearly. Please verify the merchant and total manually.",
      422,
      { validation, rawOcrText: extracted.rawOcrText },
    );
  }

  return {
    extracted: {
      merchant: extracted.merchant,
      amount: extracted.total,
      date: extracted.date ?? new Date().toISOString().slice(0, 10),
      category: extracted.category ?? "Miscellaneous",
      subcategory: "Receipt",
      confidence: extracted.confidence,
      source: "ocr" as const,
      currency: extracted.currency ?? "INR",
      subtotal: extracted.subtotal,
      tax: extracted.tax,
      discount: extracted.discount,
      paymentMethod: extracted.paymentMethod,
      items: extracted.items,
      fieldConfidence: extracted.fieldConfidence,
    },
    receiptHash,
    fileReference,
    rawOcrText: extracted.rawOcrText,
    validation,
    duplicate,
  };
}

export async function confirmReceiptForUser(
  userId: string,
  payload: {
    merchant: string;
    amount: number;
    date: string;
    category: string;
    subcategory?: string;
    source?: "ocr" | "manual" | "ai";
    currency?: string;
    subtotal?: number | null;
    tax?: number | null;
    discount?: number | null;
    paymentMethod?: string | null;
    items?: unknown[];
    receiptHash?: string;
    originalFileName?: string;
    fileReference?: string;
    rawOcrText?: string;
    extractionConfidence?: number;
    validationFlags?: string[];
    saveDuplicate?: boolean;
  },
) {
  const merchant = payload.merchant.trim();
  const amount = Number(payload.amount);
  const date = new Date(payload.date);
  if (
    !merchant ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    Number.isNaN(date.getTime())
  ) {
    throw new AppError("Receipt merchant, total, and date must be valid.", 400);
  }

  const duplicate = await findReceiptDuplicate(
    userId,
    payload.receiptHash,
    merchant,
    payload.date,
    amount,
  );
  if (duplicate.likelyDuplicate && !payload.saveDuplicate) {
    throw new AppError(
      "This receipt may already exist in your expenses.",
      409,
      { duplicate },
    );
  }

  const category = payload.category.trim();
  const confirmation = await ReceiptConfirmation.create({
    user: userId,
    merchant,
    amount,
    date,
    category,
    subcategory: payload.subcategory?.trim() || undefined,
    source: payload.source ?? "manual",
    currency: payload.currency ?? "INR",
    subtotal: payload.subtotal ?? undefined,
    tax: payload.tax ?? undefined,
    discount: payload.discount ?? undefined,
    paymentMethod: payload.paymentMethod ?? "Receipt",
    items: payload.items ?? [],
    receiptHash: payload.receiptHash,
    originalFileName: payload.originalFileName,
    fileReference: payload.fileReference,
    rawOcrText: payload.rawOcrText,
    extractionConfidence: payload.extractionConfidence,
    validationFlags: payload.validationFlags ?? [],
  });
  const transaction = await Transaction.create({
    user: userId,
    type: "expense",
    amount,
    description: `Receipt: ${merchant}`,
    category,
    paymentMethod: payload.paymentMethod ?? "Receipt",
    merchant,
    date,
  });

  return {
    id: String(confirmation._id),
    transactionId: String(transaction._id),
    merchant: confirmation.merchant,
    amount: confirmation.amount,
    date: new Date(confirmation.date).toISOString().slice(0, 10),
    category: confirmation.category,
    subcategory: confirmation.subcategory ?? "Uncategorized",
    source: confirmation.source,
    currency: confirmation.currency,
    duplicate: duplicate.likelyDuplicate,
  };
}
