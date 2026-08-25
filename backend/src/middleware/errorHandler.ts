import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/appError.js';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError('Route not found', 404));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof Error ? err.message : 'Internal server error';

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
