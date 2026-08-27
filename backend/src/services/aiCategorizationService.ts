import { AppError } from '../utils/appError.js';
import AICorrection from '../models/AICorrection.js';
import { z } from 'zod';

export interface CategorizationHistoryItem {
  merchant?: string;
  category?: string;
  subcategory?: string;
}

export interface CategorizationInput {
  merchant?: string;
  description?: string;
  amount?: number;
  history?: CategorizationHistoryItem[];
}

export interface CategorizationResult {
  category: string;
  subcategory: string;
  confidence: number;
  reason: string;
  source: 'ai' | 'correction' | 'rule';
}

const DEFAULT_CATEGORY = {
  category: 'Miscellaneous',
  subcategory: 'Uncategorized',
  confidence: 0.25,
  reason: 'No clear pattern matched. Defaulted to a safe category.'
};

const aiResponseSchema = z.object({
  category: z.string().trim().min(1).max(100),
  subcategory: z.string().trim().min(1).max(100),
  confidence: z.number().finite().min(0).max(1),
  reason: z.string().trim().min(1).max(500).optional()
});

const ruleDefinitions = [
  {
    matcher: /(uber eats|uber|doordash|grubhub|zomato|swiggy|foodpanda|delivery|restaurant|pizza|burger)/i,
    category: 'Food & Dining',
    subcategory: 'Food Delivery',
    reason: 'Merchant and description match food delivery or restaurant patterns.'
  },
  {
    matcher: /(netflix|spotify|youtube|hulu|disney|prime video|apple tv|streaming|subscription)/i,
    category: 'Entertainment',
    subcategory: 'Streaming Services',
    reason: 'Merchant indicates a streaming or digital entertainment subscription.'
  },
  {
    matcher: /(lyft|uber ride|cab|taxi|ride share|metro|bus|rail|transit|train)/i,
    category: 'Transport',
    subcategory: 'Ride Services',
    reason: 'Merchant and description match transport or rideshare activity.'
  },
  {
    matcher: /(aldi|walmart|target|tesco|whole foods|grocery|supermarket|marketplace|fresh)/i,
    category: 'Groceries',
    subcategory: 'Household Essentials',
    reason: 'Merchant indicates grocery or household essentials spending.'
  },
  {
    matcher: /(amazon|ebay|shop|mall|apparel|clothing|electronics)/i,
    category: 'Shopping',
    subcategory: 'Retail Purchases',
    reason: 'Merchant matches general retail or online shopping spend.'
  },
  {
    matcher: /(rent|mortgage|landlord|apartment|housing|lease)/i,
    category: 'Housing',
    subcategory: 'Rent & Utilities',
    reason: 'Merchant indicates fixed housing or property payments.'
  }
];

export function normalizeMerchant(value?: string) {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function findLatestUserCorrection(userId: string, merchant?: string) {
  const normalizedMerchant = normalizeMerchant(merchant);
  if (!normalizedMerchant) {
    return null;
  }

  return AICorrection.findOne({ user: userId, normalizedMerchant }).sort({ updatedAt: -1 }).lean();
}

function matchHistory(history: CategorizationHistoryItem[] = [], merchant?: string) {
  const normalizedMerchant = normalizeMerchant(merchant);
  if (!normalizedMerchant || history.length === 0) {
    return null;
  }

  const exactMatch = history.find((entry) => normalizeMerchant(entry.merchant) === normalizedMerchant);
  if (exactMatch) {
    return {
      category: exactMatch.category ?? 'Miscellaneous',
      subcategory: exactMatch.subcategory ?? 'Uncategorized',
      reason: `Matched your previous merchant history for ${merchant}.`
    };
  }

  const keywordMatch = history.find((entry) => {
    const candidate = [entry.merchant, entry.category, entry.subcategory].filter(Boolean).join(' ').toLowerCase();
    return candidate.includes(normalizedMerchant) || normalizedMerchant.includes(candidate.replace(/\s+/g, ''));
  });

  if (keywordMatch) {
    return {
      category: keywordMatch.category ?? 'Miscellaneous',
      subcategory: keywordMatch.subcategory ?? 'Uncategorized',
      reason: `Matched a previous category pattern from similar merchant history.`
    };
  }

  return null;
}

function getRuleBasedPrediction(input: CategorizationInput): CategorizationResult {
  const combinedText = `${input.merchant ?? ''} ${input.description ?? ''}`.toLowerCase();

  const historyMatch = matchHistory(input.history ?? [], input.merchant);
  if (historyMatch) {
    return {
      category: historyMatch.category,
      subcategory: historyMatch.subcategory,
      confidence: 0.88,
      reason: historyMatch.reason,
      source: 'rule'
    };
  }

  const matchedRule = ruleDefinitions.find((rule) => rule.matcher.test(combinedText));
  if (matchedRule) {
    return {
      category: matchedRule.category,
      subcategory: matchedRule.subcategory,
      confidence: 0.8,
      reason: matchedRule.reason,
      source: 'rule'
    };
  }

  if (typeof input.amount === 'number' && input.amount > 1000) {
    return {
      category: 'Housing',
      subcategory: 'Rent & Utilities',
      confidence: 0.4,
      reason: 'Large recurring spending often aligns with recurring fixed expenses.',
      source: 'rule'
    };
  }

  return {
    category: DEFAULT_CATEGORY.category,
    subcategory: DEFAULT_CATEGORY.subcategory,
    confidence: DEFAULT_CATEGORY.confidence,
    reason: DEFAULT_CATEGORY.reason,
    source: 'rule'
  };
}

function getMockAiResponse(input: CategorizationInput): CategorizationResult {
  const merchant = normalizeMerchant(input.merchant);
  const description = (input.description ?? '').toLowerCase();

  if (merchant.includes('uber') || merchant.includes('zomato') || merchant.includes('swiggy') || description.includes('delivery')) {
    return {
      category: 'Food & Dining',
      subcategory: 'Food Delivery',
      confidence: 0.97,
      reason: 'Mock AI detected food delivery intent from the merchant and order description.',
      source: 'ai'
    };
  }

  if (merchant.includes('netflix') || merchant.includes('spotify') || description.includes('subscription')) {
    return {
      category: 'Entertainment',
      subcategory: 'Streaming Services',
      confidence: 0.95,
      reason: 'Mock AI identified a digital entertainment or subscription pattern.',
      source: 'ai'
    };
  }

  if (merchant.includes('lyft') || merchant.includes('uber ride') || description.includes('ride')) {
    return {
      category: 'Transport',
      subcategory: 'Ride Services',
      confidence: 0.93,
      reason: 'Mock AI recognized transport usage from the merchant and trip context.',
      source: 'ai'
    };
  }

  return getRuleBasedPrediction(input);
}

async function getAiPrediction(input: CategorizationInput): Promise<CategorizationResult> {
  const provider = process.env.AI_PROVIDER?.toLowerCase();

  if (!provider || provider === 'disabled' || provider === 'off' || !process.env.AI_API_KEY) {
    throw new AppError('AI provider is unavailable. Falling back to deterministic categorization.', 200);
  }

  if (provider === 'mock') {
    return getMockAiResponse(input);
  }

  if (provider !== 'openai' && provider !== 'azure-openai' && provider !== 'anthropic') {
    const fallback = getRuleBasedPrediction(input);
    return {
      ...fallback,
      reason: 'AI provider is unsupported or misconfigured. Fallback to rule-based categorization.',
      source: 'rule'
    };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.AI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Classify expense transactions into a finance category and subcategory. Return JSON with category, subcategory, confidence, and reason.'
          },
          {
            role: 'user',
            content: JSON.stringify(input)
          }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      throw new Error('AI provider responded with an error');
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? '';
    const parsed = aiResponseSchema.parse(JSON.parse(content));
    return {
      category: parsed.category,
      subcategory: parsed.subcategory,
      confidence: parsed.confidence,
      reason: parsed.reason ?? 'AI-generated recommendation.',
      source: 'ai'
    };
  } catch {
    const fallback = getRuleBasedPrediction(input);
    return {
      ...fallback,
      reason: 'AI response was invalid or unavailable. Fallback to rule-based categorization.',
      source: 'rule'
    };
  }
}

export async function categorizeTransactionForUser(userId: string, input: CategorizationInput): Promise<CategorizationResult> {
  const merchant = input.merchant ?? '';
  const correction = await findLatestUserCorrection(userId, merchant);

  if (correction) {
    return {
      category: correction.correctedCategory,
      subcategory: correction.correctedSubcategory ?? 'Uncategorized',
      confidence: 0.96,
      reason: `Previous correction for ${merchant}: ${correction.reason ?? 'user adjusted this category manually.'}`,
      source: 'correction'
    };
  }

  try {
    const prediction = await getAiPrediction(input);
    if (prediction.source === 'ai') {
      return prediction;
    }
    return prediction;
  } catch (error) {
    const fallback = getRuleBasedPrediction(input);
    const reason = error instanceof AppError
      ? `${error.message} Deterministic fallback categorization was used.`
      : 'AI service was unavailable or returned invalid data. Fallback to deterministic rule-based categorization.';

    return {
      ...fallback,
      reason,
      source: 'rule'
    };
  }
}

export async function saveCategoryCorrectionForUser(userId: string, payload: {
  merchant: string;
  originalCategory?: string;
  correctedCategory: string;
  correctedSubcategory?: string;
  reason?: string;
}) {
  const normalizedMerchant = normalizeMerchant(payload.merchant);

  if (!normalizedMerchant) {
    throw new AppError('A merchant name is required to save a correction.', 400);
  }

  const updated = await AICorrection.findOneAndUpdate(
    { user: userId, normalizedMerchant },
    {
      user: userId,
      merchant: payload.merchant.trim(),
      normalizedMerchant,
      originalCategory: payload.originalCategory?.trim() || undefined,
      correctedCategory: payload.correctedCategory.trim(),
      correctedSubcategory: payload.correctedSubcategory?.trim() || undefined,
      reason: payload.reason?.trim() || 'User manually corrected the category.'
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    id: String(updated._id),
    user: String(updated.user),
    merchant: updated.merchant,
    originalCategory: updated.originalCategory,
    category: updated.correctedCategory,
    subcategory: updated.correctedSubcategory ?? 'Uncategorized',
    reason: updated.reason ?? 'User manually corrected the category.'
  };
}
