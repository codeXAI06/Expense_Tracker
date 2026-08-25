import dotenv from 'dotenv';

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/expense-tracker-dev',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173'
};
