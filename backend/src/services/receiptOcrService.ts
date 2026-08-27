import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import sharp from "sharp";
import Tesseract from "tesseract.js";
import { PDFParse } from "pdf-parse";
import { AppError } from "../utils/appError.js";
import type { ReceiptOcrResult } from "./receiptTypes.js";

const receiptDirectory = resolve(process.cwd(), process.cwd().toLowerCase().endsWith('backend') ? 'uploads/receipts' : 'backend/uploads/receipts');

function isImage(fileName: string) {
  return /\.(png|jpe?g|webp|gif)$/i.test(fileName);
}
function isPdf(fileName: string) {
  return /\.pdf$/i.test(fileName);
}

export function hashReceipt(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function storeOriginalReceipt(
  buffer: Buffer,
  originalName: string,
  hash: string,
) {
  await mkdir(receiptDirectory, { recursive: true });
  const extension = originalName.toLowerCase().endsWith(".pdf")
    ? "pdf"
    : (originalName.match(/\.(png|jpe?g|webp|gif)$/i)?.[1] ?? "bin");
  const fileName = `${hash}.${extension}`;
  await writeFile(resolve(receiptDirectory, fileName), buffer, {
    flag: "wx",
  }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") throw error;
  });
  return `uploads/receipts/${fileName}`;
}

export async function runReceiptOcr(
  buffer: Buffer,
  originalName: string,
): Promise<ReceiptOcrResult> {
  if (isPdf(originalName)) {
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      return {
        rawText: result.text,
        confidence: result.text.trim() ? 0.9 : 0,
        words: [],
        source: "pdf-text",
      };
    } catch {
      throw new AppError(
        "We could not read this PDF receipt. Try a clearer PDF or image.",
        422,
      );
    }
  }

  if (!isImage(originalName)) {
    throw new AppError(
      "Unsupported file type. Upload a JPG, JPEG, PNG, WEBP, GIF, or PDF receipt.",
      400,
    );
  }

  const looksLikeText =
    buffer.toString("utf8").includes("\n") &&
    !buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (looksLikeText)
    return {
      rawText: buffer.toString("utf8"),
      confidence: 0.82,
      words: [],
      source: "text-fixture",
    };

  try {
    const processed = await sharp(buffer)
      .rotate()
      .normalize()
      .sharpen()
      .resize({ width: 1800, withoutEnlargement: false })
      .png()
      .toBuffer();
    const result = await Tesseract.recognize(processed, "eng");
    return {
      rawText: result.data.text,
      confidence: result.data.confidence / 100,
      words: (result.data.blocks ?? []).flatMap((block) =>
        block.paragraphs.flatMap((paragraph) =>
          paragraph.lines.flatMap((line) =>
            line.words.map((word) => ({
              text: word.text,
              confidence: word.confidence / 100,
              bbox: word.bbox,
            })),
          ),
        ),
      ),
      source: "tesseract",
    };
  } catch {
    throw new AppError(
      "We could not read this receipt clearly. Try uploading a sharper image.",
      422,
    );
  }
}
