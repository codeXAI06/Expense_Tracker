import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/appError.js';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError('Route not found', 404));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  let statusCode = 500;
  let message = 'Internal server error';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = err.issues[0]?.message ?? 'Invalid input';
  } else if (err instanceof Error && 'code' in err && err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'CSV file is too large. Maximum size is 2MB.';
  } else if (err instanceof Error && 'code' in err && err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message = 'Only CSV files are allowed.';
  } else if (err instanceof Error) {
    message = err.message;
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error('Unhandled error:', message);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(statusCode >= 500 ? { error: 'Internal server error' } : {}),
    ...(err instanceof AppError && err.details ? { details: err.details } : {})
  });
}
