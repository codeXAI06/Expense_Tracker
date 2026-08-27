import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/appError.js';
import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';

export interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string; name: string };
}

export async function protect(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication token is missing or invalid', 401);
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    const user = await User.findById(payload.userId).select('-password');

    if (!user) {
      throw new AppError('User not found', 401);
    }

    req.user = {
      id: String(user._id),
      email: user.email,
      name: user.name
    };

    next();
  } catch (error) {
    next(error);
  }
}
