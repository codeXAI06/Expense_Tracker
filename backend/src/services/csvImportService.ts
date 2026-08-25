import { AppError } from '../utils/appError.js';
import Transaction from '../models/Transaction.js';

export interface CsvMapping {
  date: string;
  description: string;
  amount: string;
  category: string;
  paymentMethod: string;
  merchant: string;
}

export interface CsvRow {
  date: string;
  description: string;
  amount: number;
  category: string;
  paymentMethod: string;
  merchant: string;
  type: 'income' | 'expense' | 'transfer';
  valid: boolean;
  reason?: string;
}

export interface CsvPreviewResult {
  rows: CsvRow[];
  summary: {
    imported: number;
    skipped: number;
    duplicates: number;
    invalid: number;
  };
}

const REQUIRED_COLUMNS = ['date', 'description', 'amount', 'category', 'paymentMethod', 'merchant'];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

export function parseCsvPreview(csvText: string, mapping: Partial<CsvMapping>): CsvPreviewResult {
  const lines = csvText.replace(/\r/g, '').split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new AppError('CSV is missing required rows or headers', 400);
  }

  const parsedHeader = lines[0].split(',').map((header) => normalizeHeader(header));
  const requiredMap = {
    date: mapping.date,
    description: mapping.description,
    amount: mapping.amount,
    category: mapping.category,
    paymentMethod: mapping.paymentMethod,
    merchant: mapping.merchant
  } as Record<string, string | undefined>;

  const missingColumns = REQUIRED_COLUMNS.filter((key) => !requiredMap[key] || !parsedHeader.includes(normalizeHeader(requiredMap[key]!)));
  if (missingColumns.length > 0) {
    throw new AppError(`CSV is missing required columns: ${missingColumns.join(', ')}`, 400);
  }

  const rows: CsvRow[] = [];
  const seen = new Set<string>();

  for (let index = 1; index < lines.length; index += 1) {
    const columns = lines[index].split(',');
    if (columns.length < 2) {
      rows.push({
        date: '',
        description: '',
        amount: 0,
        category: '',
        paymentMethod: '',
        merchant: '',
        type: 'expense',
        valid: false,
        reason: 'Malformed row'
      });
      continue;
    }

    const rawRecord: Record<string, string> = {};
    for (const key of Object.keys(requiredMap)) {
      const columnName = requiredMap[key as keyof typeof requiredMap];
      if (!columnName) continue;
      const headerIndex = parsedHeader.indexOf(normalizeHeader(columnName));
      rawRecord[key] = columns[headerIndex] ? columns[headerIndex].trim() : '';
    }

    const amount = Number(rawRecord.amount ?? '0');
    const isDuplicate = seen.has(`${rawRecord.date}|${rawRecord.description}|${rawRecord.amount}|${rawRecord.merchant}`);

    if (isDuplicate) {
      rows.push({
        date: rawRecord.date || '',
        description: rawRecord.description || '',
        amount,
        category: rawRecord.category || '',
        paymentMethod: rawRecord.paymentMethod || '',
        merchant: rawRecord.merchant || '',
        type: amount >= 0 ? 'income' : 'expense',
        valid: false,
        reason: 'Duplicate row'
      });
      seen.add(`${rawRecord.date}|${rawRecord.description}|${rawRecord.amount}|${rawRecord.merchant}`);
      continue;
    }

    const rowIsValid = !!rawRecord.date && !!rawRecord.description && rawRecord.amount !== '' && !Number.isNaN(amount) && !!rawRecord.category && !!rawRecord.paymentMethod;

    if (!rowIsValid) {
      rows.push({
        date: rawRecord.date || '',
        description: rawRecord.description || '',
        amount,
        category: rawRecord.category || '',
        paymentMethod: rawRecord.paymentMethod || '',
        merchant: rawRecord.merchant || '',
        type: amount >= 0 ? 'income' : 'expense',
        valid: false,
        reason: 'Missing or invalid required value'
      });
      continue;
    }

    const normalizedRow: CsvRow = {
      date: rawRecord.date,
      description: rawRecord.description,
      amount,
      category: rawRecord.category,
      paymentMethod: rawRecord.paymentMethod,
      merchant: rawRecord.merchant,
      type: amount >= 0 ? 'income' : 'expense',
      valid: true
    };

    seen.add(`${rawRecord.date}|${rawRecord.description}|${rawRecord.amount}|${rawRecord.merchant}`);
    rows.push(normalizedRow);
  }

  const imported = rows.filter((row) => row.valid).length;
  const duplicates = rows.filter((row) => row.reason === 'Duplicate row').length;
  const invalid = rows.filter((row) => !row.valid && row.reason !== 'Duplicate row').length;

  return {
    rows,
    summary: {
      imported,
      skipped: rows.length - imported - duplicates - invalid,
      duplicates,
      invalid
    }
  };
}

export async function importCsvTransactionsForUser(userId: string, csvText: string, mapping: Partial<CsvMapping>) {
  const preview = parseCsvPreview(csvText, mapping);
  const validRows = preview.rows.filter((row) => row.valid);

  for (const row of validRows) {
    await Transaction.create({
      user: userId,
      type: row.type,
      amount: Math.abs(row.amount),
      description: row.description,
      category: row.category,
      paymentMethod: row.paymentMethod,
      merchant: row.merchant,
      date: new Date(row.date)
    });
  }

  return {
    rows: preview.rows,
    summary: {
      imported: validRows.length,
      skipped: preview.summary.skipped,
      duplicates: preview.summary.duplicates,
      invalid: preview.summary.invalid
    }
  };
}
