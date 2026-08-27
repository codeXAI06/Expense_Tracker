import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";

let mongoServer: MongoMemoryServer;
let token: string;
const originalProvider = process.env.AI_PROVIDER;
const originalApiKey = process.env.AI_API_KEY;

beforeAll(async () => {
  process.env.AI_PROVIDER = 'mock';
  delete process.env.AI_API_KEY;
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri("expense-tracker-receipts"));

  const registerResponse = await request(app).post("/api/auth/register").send({
    name: "Receipt User",
    email: "receipt@example.com",
    password: "StrongPass123!",
  });

  token = registerResponse.body.token;
}, 60000);

afterAll(async () => {
  process.env.AI_PROVIDER = originalProvider;
  process.env.AI_API_KEY = originalApiKey;
  if (mongoose.connection.readyState) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
}, 60000);

describe("Receipt intelligence API", () => {
  it("extracts merchant, amount, and category from a receipt image", async () => {
    const receiptText = Buffer.from(
      "STARBUCKS\nCOFFEE HOUSE\nTOTAL $18.75\n2026-08-12",
    );

    const response = await request(app)
      .post("/api/receipts/analyze")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", receiptText, {
        filename: "receipt.png",
        contentType: "image/png",
      })
      .expect(200);

    expect(response.body.extracted.merchant).toMatch(/starbucks|coffee/i);
    expect(response.body.extracted.amount).toBeGreaterThan(0);
    expect(response.body.extracted.category).toMatch(/food|coffee|beverage/i);
    expect(response.body.extracted.confidence).toBeGreaterThan(0.5);
  });

  it("extracts labeled rupee amount and Indian date without using the date year", async () => {
    const receiptText = Buffer.from(
      "FreshMart Grocery\nITEM Rice 120\nTOTAL ₹1,250.50\nDATE 27/08/2026",
    );

    const response = await request(app)
      .post("/api/receipts/analyze")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", receiptText, {
        filename: "freshmart.png",
        contentType: "image/png",
      })
      .expect(200);

    expect(response.body.extracted.merchant).toMatch(/freshmart/i);
    expect(response.body.extracted.amount).toBe(1250.5);
    expect(response.body.extracted.date).toBe("2026-08-27");
    expect(response.body.extracted.category).toBe("Groceries");
  });

  it("prefers the GST-inclusive total over subtotal and tax lines", async () => {
    const receiptText = Buffer.from(
      "URBAN MART\nSUBTOTAL ₹1,000\nCGST 9% ₹90\nSGST 9% ₹90\nTOTAL INCL GST ₹1,180\nDATE 27/08/2026",
    );

    const response = await request(app)
      .post("/api/receipts/analyze")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", receiptText, {
        filename: "urban-mart.png",
        contentType: "image/png",
      })
      .expect(200);

    expect(response.body.extracted.amount).toBe(1180);
    expect(response.body.extracted.category).toBe("Groceries");
  });

  it("keeps OCR totals authoritative when the optional LLM disagrees", async () => {
    const originalProvider = process.env.AI_PROVIDER;
    const originalKey = process.env.AI_API_KEY;
    const originalFetch = globalThis.fetch;
    process.env.AI_PROVIDER = "openai";
    process.env.AI_API_KEY = "test-key";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  merchant: "Urban Mart",
                  total: 1613,
                  currency: "USD",
                  category: "Miscellaneous",
                  items: [],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      );

    try {
      const response = await request(app)
        .post("/api/receipts/analyze")
        .set("Authorization", `Bearer ${token}`)
        .attach(
          "file",
          Buffer.from(
            "Urban Mart\nSUBTOTAL ₹500\nCGST ₹50\nSGST ₹50\nTOTAL ₹600\nDATE 27/08/2026",
          ),
          { filename: "urban.png", contentType: "image/png" },
        )
        .expect(200);

      expect(response.body.extracted.amount).toBe(600);
      expect(response.body.extracted.currency).toBe("INR");
      expect(response.body.extracted.category).toBe("Groceries");
    } finally {
      process.env.AI_PROVIDER = originalProvider;
      process.env.AI_API_KEY = originalKey;
      globalThis.fetch = originalFetch;
    }
  });

  it("stores a user confirmation for extracted receipt data", async () => {
    const response = await request(app)
      .post("/api/receipts/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({
        merchant: "Starbucks",
        amount: 18.75,
        date: "2026-08-12",
        category: "Food & Dining",
        subcategory: "Coffee Shops",
        source: "ocr",
      })
      .expect(201);

    expect(response.body.confirmation.merchant).toBe("Starbucks");
    expect(response.body.confirmation.amount).toBe(18.75);
    expect(response.body.confirmation.category).toBe("Food & Dining");
    expect(response.body.confirmation.transactionId).toBeTruthy();

    const transactions = await request(app)
      .get("/api/transactions?search=Starbucks")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(transactions.body.items).toHaveLength(1);
    expect(transactions.body.items[0].type).toBe("expense");
    expect(transactions.body.items[0].paymentMethod).toBe("Receipt");
  });

  it("flags duplicate receipts and allows an explicit override", async () => {
    const receiptText = Buffer.from(
      "Duplicate Mart\nTOTAL ₹450\nDATE 28/08/2026",
    );
    const analyzed = await request(app)
      .post("/api/receipts/analyze")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", receiptText, {
        filename: "duplicate.png",
        contentType: "image/png",
      })
      .expect(200);

    const payload = {
      ...analyzed.body.extracted,
      receiptHash: analyzed.body.receiptHash,
      fileReference: analyzed.body.fileReference,
      rawOcrText: analyzed.body.rawOcrText,
      extractionConfidence: analyzed.body.extracted.confidence,
    };

    await request(app)
      .post("/api/receipts/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send(payload)
      .expect(201);
    const duplicate = await request(app)
      .post("/api/receipts/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send(payload)
      .expect(409);
    expect(duplicate.body.message).toMatch(/already exist|duplicate/i);

    await request(app)
      .post("/api/receipts/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...payload, saveDuplicate: true })
      .expect(201);
  });

  it("rejects unsupported file types", async () => {
    const response = await request(app)
      .post("/api/receipts/analyze")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("not an image"), {
        filename: "notes.txt",
        contentType: "text/plain",
      })
      .expect(400);

    expect(response.body.message).toMatch(/image|receipt|supported/i);
  });

  it("does not invent data when an image cannot be read", async () => {
    const response = await request(app)
      .post("/api/receipts/analyze")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from([0, 1, 2, 3]), {
        filename: "unreadable.png",
        contentType: "image/png",
      })
      .expect(422);

    expect(response.body.message).toMatch(/extract|manually|receipt/i);
  });
});
