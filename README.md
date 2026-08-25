# AI Financial Intelligence Platform

A production-style financial operating system built with the MERN stack and a strong analytics-first architecture. The project is being developed in staged versions, beginning with the foundation package for authentication, health checks, environment setup, and a polished app shell.

## Overview

This application is designed to help users understand where their money goes, detect unusual spending behavior, forecast future cash flow, and model financial goals before making decisions. The product avoids AI-only decisioning by separating deterministic analytics from LLM explanation.

## Version roadmap

- v0.1.0 — foundation, auth, health checks, dashboard shell
- v0.2.0 — transaction engine
- v0.3.0 — CSV import
- v0.4.0 — AI categorization
- v0.5.0 — receipt intelligence
- v0.6.0 — spending intelligence engine
- v0.7.0 — anomaly detection
- v0.8.0 — subscriptions and recurring expenses
- v0.9.0 — forecasting
- v0.10.0 — financial goals
- v0.11.0 — what-if scenarios
- v0.12.0 — investigative spending feature
- v0.13.0 — AI financial assistant
- v0.14.0 — monthly financial report
- v0.15.0 — advanced polish
- v1.0.0 — production release

## Architecture

### Backend
- Express API with TypeScript
- MongoDB via Mongoose
- JWT-based authentication
- Centralized error handling
- Zod validation
- Health endpoints and secure config

### Frontend
- React + Vite + TypeScript
- Tailwind styling
- Router-based shell
- Dashboard-first landing experience

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Environment variables

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/expense-tracker-dev
JWT_SECRET=change-me-in-production
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

## Testing

```bash
npm test
```

## Deployment

The app is designed for a split deployment model:
- Frontend: Vercel or Netlify
- Backend: Render or Railway
- Database: MongoDB Atlas

## Security notes

- No secrets are committed to source control
- JWTs are signed server-side
- Passwords are hashed with bcrypt
- Input validation is enforced by Zod
- CORS and request limits are configured

## Project status

Current stage: v0.1.0 foundation
