import ReceiptConfirmation from "../models/ReceiptConfirmation.js";

export async function findReceiptDuplicate(
  userId: string,
  receiptHash?: string,
  merchant?: string,
  date?: string,
  total?: number,
) {
  const exact = receiptHash
    ? await ReceiptConfirmation.findOne({ user: userId, receiptHash }).lean()
    : null;
  if (exact)
    return {
      likelyDuplicate: true,
      reason: "The same receipt file was already confirmed.",
      existing: exact,
    };
  if (!merchant || !date || total === null || total === undefined)
    return { likelyDuplicate: false };
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);
  const similar = await ReceiptConfirmation.findOne({
    user: userId,
    merchant: new RegExp(
      `^${merchant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      "i",
    ),
    date: { $gte: dayStart, $lte: dayEnd },
    amount: { $gte: total * 0.995, $lte: total * 1.005 },
  }).lean();
  return similar
    ? {
        likelyDuplicate: true,
        reason:
          "A receipt with the same merchant, date, and total already exists.",
        existing: similar,
      }
    : { likelyDuplicate: false };
}
