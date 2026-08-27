import { AppError } from '../utils/appError.js';
import ReceiptConfirmation from '../models/ReceiptConfirmation.js';
import Transaction from '../models/Transaction.js';
import Tesseract from 'tesseract.js';

export interface ReceiptExtraction {
  merchant: string;
  amount: number;
  date: string;
  category: string;
  subcategory: string;
  confidence: number;
  source: 'ocr' | 'rule' | 'manual';
}

function isBinaryImage(buffer: Buffer) {
  return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ||
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' ||
    buffer.subarray(4, 8).toString('ascii') === 'WEBP' ||
    buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
    buffer.subarray(0, 6).toString('ascii') === 'GIF89a';
}

function extractFromText(content: string): ReceiptExtraction {
  const normalized = content.replace(/\s+/g, ' ').trim();
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const merchantLine = lines.find((line) => /starbucks|coffee|grocery|amazon|mcdonald|restaurant|uber|zomato|walmart|subway|dunkin|swiggy|domino/i.test(line)) ?? lines.find((line) => !/total|amount|date|tax|subtotal|invoice|receipt|cash|card|upi/i.test(line)) ?? lines[0] ?? 'Unknown Merchant';
  const merchant = merchantLine.replace(/[₹$]|\b(?:RS|INR|TOTAL|DATE|AMOUNT)\b/gi, '').replace(/\d[\d,]*(?:\.\d+)?/g, '').trim() || 'Unknown Merchant';

  const labeledAmount = normalized.match(/(?:grand\s+total|total|amount\s+due|net\s+amount|payable|balance\s+due)\s*[:\-]?\s*(?:₹|rs\.?|inr|\$)?\s*([\d,]+(?:\.\d{1,2})?)/i)?.[1];
  const currencyAmount = normalized.match(/(?:₹|rs\.?|inr|\$)\s*([\d,]+(?:\.\d{1,2})?)/i)?.[1];
  const amountValue = labeledAmount ?? currencyAmount ?? '0';
  const amount = Number(amountValue.replace(/,/g, '')) || 0;

  const dateMatch = normalized.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4})/);
  const date = dateMatch ? normalizeReceiptDate(dateMatch[1]) : new Date().toISOString().slice(0, 10);

  let category = 'Food & Dining';
  let subcategory = 'Coffee Shops';

  const receiptText = `${merchant} ${normalized}`;
  if (/starbucks|coffee|cafe|tea|espresso/i.test(receiptText)) {
    category = 'Food & Dining';
    subcategory = 'Coffee Shops';
  } else if (/amazon|walmart|grocery|market|supermarket|bigbasket|zepto/i.test(receiptText)) {
    category = 'Groceries';
    subcategory = 'Household Essentials';
  } else if (/uber|zomato|swiggy|restaurant|pizza|burger|domino/i.test(receiptText)) {
    category = 'Food & Dining';
    subcategory = 'Food Delivery';
  } else if (/netflix|spotify|streaming/i.test(receiptText)) {
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

function normalizeReceiptDate(value: string) {
  const separator = value.includes('/') ? '/' : value.includes('.') ? '.' : '-';
  const parts = value.split(separator).map(Number);
  const [first, second, third] = parts;
  const isoParts = first > 999 ? [first, second, third] : [third, second, first];
  const [year, month, day] = isoParts;
  if (!year || !month || !day || month > 12 || day > 31) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

export async function analyzeReceiptForUser(_userId: string, fileBuffer: Buffer, originalFileName: string) {
  const mime = /^image\/(png|jpeg|jpg|webp|gif)$/i.test(originalFileName) || /\.(png|jpe?g|webp|gif)$/i.test(originalFileName)
    ? 'image'
    : '';

  if (!mime) {
    throw new AppError('Unsupported file type. Please upload a receipt image (PNG, JPG, JPEG, WEBP, or GIF).', 400);
  }

  let content: string;
  if (isBinaryImage(fileBuffer)) {
    try {
      const ocrResult = await Tesseract.recognize(fileBuffer, 'eng');
      content = ocrResult.data.text;
    } catch {
      throw new AppError('Receipt details could not be extracted. Please review the receipt manually.', 422);
    }
  } else {
    content = fileBuffer.toString('utf-8');
  }
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
  const merchant = payload.merchant.trim();
  const amount = Number(payload.amount);
  const date = new Date(payload.date);
  const category = payload.category.trim();
  const subcategory = payload.subcategory?.trim() || undefined;
  const source = payload.source ?? 'manual';

  const transaction = await Transaction.create({
    user: userId,
    type: 'expense',
    amount,
    description: `Receipt: ${merchant}`,
    category,
    paymentMethod: 'Receipt',
    merchant,
    date
  });

  const confirmation = await ReceiptConfirmation.create({
    user: userId,
    merchant,
    amount,
    date,
    category,
    subcategory,
    source
  });

  return {
    id: String(confirmation._id),
    transactionId: String(transaction._id),
    merchant: confirmation.merchant,
    amount: confirmation.amount,
    date: new Date(confirmation.date).toISOString().slice(0, 10),
    category: confirmation.category,
    subcategory: confirmation.subcategory ?? 'Uncategorized',
    source: confirmation.source
  };
}
