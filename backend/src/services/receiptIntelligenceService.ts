import { AppError } from '../utils/appError.js';
import ReceiptConfirmation from '../models/ReceiptConfirmation.js';

export interface ReceiptExtraction {
  merchant: string;
  amount: number;
  date: string;
  category: string;
  subcategory: string;
  confidence: number;
  source: 'ocr' | 'rule' | 'manual';
}

function extractFromText(content: string): ReceiptExtraction {
  const normalized = content.replace(/\s+/g, ' ').trim();
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const merchantLine = lines.find((line) => /starbucks|coffee|grocery|amazon|mcdonald|restaurant|uber|zomato|walmart|subway|dunkin/i.test(line)) ?? lines[0] ?? 'Unknown Merchant';
  const merchant = merchantLine.replace(/\$|\d|TOTAL|DATE|AMOUNT/gi, '').trim() || 'Unknown Merchant';

  const amountMatch = normalized.match(/\$?\s?(\d+(?:\.\d{1,2})?)/g)?.slice(-1)[0];
  const amount = Number((amountMatch ?? '0').replace(/[^\d.]/g, '')) || 0;

  const dateMatch = normalized.match(/(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})/);
  const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

  let category = 'Food & Dining';
  let subcategory = 'Coffee Shops';

  if (/starbucks|coffee|cafe|tea|espresso/i.test(merchant)) {
    category = 'Food & Dining';
    subcategory = 'Coffee Shops';
  } else if (/amazon|walmart|grocery|market/i.test(merchant)) {
    category = 'Groceries';
    subcategory = 'Household Essentials';
  } else if (/uber|zomato|restaurant|pizza|burger/i.test(merchant)) {
    category = 'Food & Dining';
    subcategory = 'Food Delivery';
  } else if (/netflix|spotify|streaming/i.test(merchant)) {
    category = 'Entertainment';
    subcategory = 'Streaming Services';
  } else {
    category = 'Miscellaneous';
    subcategory = 'Uncategorized';
  }

  return {
    merchant: merchant || 'Unknown Merchant',
    amount: Number(amount.toFixed(2)),
    date,
    category,
    subcategory,
    confidence: 0.82,
    source: 'ocr'
  };
}

export async function analyzeReceiptForUser(_userId: string, fileBuffer: Buffer, originalFileName: string) {
  const mime = /^image\/(png|jpeg|jpg|webp|gif)$/i.test(originalFileName) || /\.(png|jpe?g|webp|gif)$/i.test(originalFileName)
    ? 'image'
    : '';

  if (!mime) {
    throw new AppError('Unsupported file type. Please upload a receipt image (PNG, JPG, JPEG, WEBP, or GIF).', 400);
  }

  const content = fileBuffer.toString('utf-8');
  const extraction = extractFromText(content);

  if (extraction.merchant === 'Unknown Merchant' || extraction.amount <= 0) {
    throw new AppError('Receipt details could not be extracted. Please review the receipt manually.', 422);
  }

  return {
    extracted: extraction,
    preview: {
      merchant: extraction.merchant,
      amount: extraction.amount,
      date: extraction.date,
      category: extraction.category,
      subcategory: extraction.subcategory,
      confidence: extraction.confidence
    }
  };
}

export async function confirmReceiptForUser(userId: string, payload: {
  merchant: string;
  amount: number;
  date: string;
  category: string;
  subcategory?: string;
  source?: 'ocr' | 'manual' | 'ai';
}) {
  const confirmation = await ReceiptConfirmation.create({
    user: userId,
    merchant: payload.merchant.trim(),
    amount: Number(payload.amount),
    date: new Date(payload.date),
    category: payload.category.trim(),
    subcategory: payload.subcategory?.trim() || undefined,
    source: payload.source ?? 'manual'
  });

  return {
    id: String(confirmation._id),
    merchant: confirmation.merchant,
    amount: confirmation.amount,
    date: new Date(confirmation.date).toISOString().slice(0, 10),
    category: confirmation.category,
    subcategory: confirmation.subcategory ?? 'Uncategorized',
    source: confirmation.source
  };
}
