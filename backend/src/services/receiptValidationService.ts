import type { ReceiptValidation, StructuredReceipt } from "./receiptTypes.js";

const tolerance = 0.02;
export function validateReceipt(receipt: StructuredReceipt): ReceiptValidation {
  const flags: string[] = [];
  const checks: ReceiptValidation["checks"] = [];
  const add = (name: string, passed: boolean, detail: string) => {
    checks.push({ name, passed, detail });
    if (!passed) flags.push(detail);
  };

  add(
    "total-present",
    receipt.total !== null,
    "Total is missing and must be verified.",
  );
  add(
    "total-non-negative",
    receipt.total === null || receipt.total >= 0,
    "Total cannot be negative.",
  );
  add(
    "date-valid",
    receipt.date !== null && !Number.isNaN(Date.parse(receipt.date)),
    "Date is missing or invalid.",
  );
  add(
    "currency-known",
    receipt.currency === null ||
      ["INR", "USD", "EUR", "GBP"].includes(receipt.currency),
    "Currency needs verification.",
  );
  add(
    "merchant-present",
    Boolean(receipt.merchant),
    "Merchant is missing and must be verified.",
  );
  for (const item of receipt.items)
    add(
      `item-${item.name}`,
      item.quantity > 0 && item.quantity <= 100,
      `Item quantity for ${item.name} needs verification.`,
    );

  if (
    receipt.subtotal !== null &&
    receipt.tax !== null &&
    receipt.total !== null
  ) {
    const expected = receipt.subtotal + receipt.tax - (receipt.discount ?? 0);
    add(
      "totals-reconcile",
      Math.abs(expected - receipt.total) <=
        Math.max(tolerance, expected * tolerance),
      "Subtotal, tax, discount, and total do not reconcile.",
    );
  }
  if (receipt.items.length > 0 && receipt.subtotal !== null) {
    const itemTotal = receipt.items.reduce(
      (sum, item) => sum + (item.totalPrice ?? 0),
      0,
    );
    add(
      "items-reconcile",
      Math.abs(itemTotal - receipt.subtotal) <=
        Math.max(1, receipt.subtotal * 0.05),
      "Line items do not closely match the subtotal.",
    );
  }

  return { valid: flags.length === 0, flags, checks };
}
