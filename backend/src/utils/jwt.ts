import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signToken(userId: string) {
  return jwt.sign({ userId }, env.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token: string) {
  return jwt.verify(token, env.jwtSecret) as { userId: string };
}
