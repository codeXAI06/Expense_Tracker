import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { protect, type AuthenticatedRequest } from '../middleware/auth.js';
import { parseCsvPreview, importCsvTransactionsForUser } from '../services/csvImportService.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
      return;
    }

    cb(new Error('Only CSV files are allowed'));
  }
});

const mappingSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1),
  amount: z.string().min(1),
  category: z.string().min(1),
  paymentMethod: z.string().min(1),
  merchant: z.string().min(1)
});

router.use(protect);

function parseMapping(raw: unknown) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('CSV mapping is required');
  }

  try {
    const parsed = JSON.parse(raw);
    return mappingSchema.parse(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('CSV mapping is invalid');
    }
    throw error;
  }
}

router.post('/preview', upload.single('file'), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'CSV file is required' });
    }

    const mapping = parseMapping(req.body?.mapping);
    const csvText = req.file.buffer.toString('utf-8');
    const result = parseCsvPreview(csvText, mapping);

    return res.json(result);
  } catch (error) {
    if ((error as Error).message.includes('File too large')) {
      return res.status(413).json({ message: 'CSV file is too large. Maximum size is 2MB.' });
    }

    if ((error as Error).message.includes('Only CSV files are allowed')) {
      return res.status(400).json({ message: 'Only CSV files are allowed.' });
    }

    next(error);
    return;
  }
});

router.post('/import', upload.single('file'), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'CSV file is required' });
    }

    const mapping = parseMapping(req.body?.mapping);
    const result = await importCsvTransactionsForUser(req.user!.id, req.file.buffer.toString('utf-8'), mapping);
    return res.status(201).json(result);
  } catch (error) {
    if ((error as Error).message.includes('File too large')) {
      return res.status(413).json({ message: 'CSV file is too large. Maximum size is 2MB.' });
    }

    next(error);
    return;
  }
});

export default router;
