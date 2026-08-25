import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { AppError } from '../utils/appError.js';
import { signToken } from '../utils/jwt.js';
import { protect, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

router.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const existingUser = await User.findOne({ email: parsed.email.toLowerCase() });

    if (existingUser) {
      throw new AppError('User already exists', 409);
    }

    const hashedPassword = await bcrypt.hash(parsed.password, 12);
    const user = await User.create({
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      password: hashedPassword
    });

    const token = signToken(String(user._id));
    res.status(201).json({
      success: true,
      token,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const user = await User.findOne({ email: parsed.email.toLowerCase() });

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isPasswordValid = await bcrypt.compare(parsed.password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = signToken(String(user._id));
    res.json({
      success: true,
      token,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', protect, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await User.findById(req.user?.id).select('-password');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
