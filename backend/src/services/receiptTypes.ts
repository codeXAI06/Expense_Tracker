export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
  category: string;
  confidence: number;
}

export interface ReceiptOcrWord {
  text: string;
  confidence: number;
  bbox?: { x0: number; y0: number; x1: number; y1: number };
}

export interface ReceiptOcrResult {
  rawText: string;
  confidence: number;
  words: ReceiptOcrWord[];
  source: 'tesseract' | 'pdf-text' | 'text-fixture';
}

export interface StructuredReceipt {
  merchant: string | null;
  date: string | null;
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  total: number | null;
  paymentMethod: string | null;
  items: ReceiptItem[];
  category: string | null;
  confidence: number;
  fieldConfidence: Record<string, number>;
  rawOcrText: string;
}

export interface ReceiptValidation {
  valid: boolean;
  flags: string[];
  checks: { name: string; passed: boolean; detail: string }[];
}
