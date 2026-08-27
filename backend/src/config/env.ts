import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

const envPath = existsSync(resolve(process.cwd(), '.env'))
  ? resolve(process.cwd(), '.env')
  : resolve(process.cwd(), 'backend/.env');
dotenv.config({ path: envPath });

const nodeEnv = process.env.NODE_ENV ?? 'development';
const jwtSecret = process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me';

if (nodeEnv === 'production') {
  if (jwtSecret === 'dev-jwt-secret-change-me' || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters in production.');
  }

  if (!process.env.MONGODB_URI || !process.env.CLIENT_URL) {
    throw new Error('MONGODB_URI and CLIENT_URL must be configured in production.');
  }
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 5000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/expense-tracker-dev',
  jwtSecret,
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173'
};
