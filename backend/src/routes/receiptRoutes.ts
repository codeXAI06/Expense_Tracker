import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { protect, type AuthenticatedRequest } from "../middleware/auth.js";
import {
  analyzeReceiptForUser,
  confirmReceiptForUser,
} from "../services/receiptIntelligenceService.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const confirmSchema = z.object({
  merchant: z.string().trim().min(1).max(200),
  amount: z.number().positive(),
  date: z.string().min(1),
  category: z.string().trim().min(1).max(100),
  subcategory: z.string().trim().max(100).optional(),
  source: z.enum(["ocr", "manual", "ai"]).optional(),
  currency: z.string().trim().length(3).optional(),
  subtotal: z.number().nonnegative().nullable().optional(),
  tax: z.number().nonnegative().nullable().optional(),
  discount: z.number().nonnegative().nullable().optional(),
  paymentMethod: z.string().trim().max(100).nullable().optional(),
  items: z.array(z.unknown()).optional(),
  receiptHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  originalFileName: z.string().trim().max(255).optional(),
  fileReference: z.string().trim().max(500).optional(),
  rawOcrText: z.string().max(100000).optional(),
  extractionConfidence: z.number().min(0).max(1).optional(),
  validationFlags: z.array(z.string().max(300)).max(50).optional(),
  saveDuplicate: z.boolean().optional(),
});

router.use(protect);

router.post(
  "/analyze",
  upload.single("file"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ message: "Receipt image or PDF is required." });
      }

      const result = await analyzeReceiptForUser(
        req.user!.id,
        req.file.buffer,
        req.file.originalname,
      );
      return res.json({ success: true, ...result });
    } catch (error) {
      next(error);
      return;
    }
  },
);

router.post("/confirm", async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = confirmSchema.parse(req.body);
    const confirmation = await confirmReceiptForUser(req.user!.id, parsed);
    return res.status(201).json({ success: true, confirmation });
  } catch (error) {
    next(error);
    return;
  }
});

export default router;
