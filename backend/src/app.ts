import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import importRoutes from './routes/importRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import receiptRoutes from './routes/receiptRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import anomalyRoutes from './routes/anomalyRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import forecastRoutes from './routes/forecastRoutes.js';
import advancedRoutes from './routes/advancedRoutes.js';

const app = express();

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
const allowedOrigins = new Set([env.clientUrl, 'http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174']);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Expense tracker API is healthy',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/analytics/anomalies', anomalyRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api', advancedRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
