# Architecture

## Goal

Build an AI financial operating system with analytics-first intelligence, secure authentication, and a strong focus on product quality.

## Backend architecture

- Express app entrypoint in src/app.ts
- Route modules for auth and later domain features
- Mongoose models for data isolation and persistence
- Middleware for auth, validation, and centralized error handling
- Utility layer for JWTs and standard errors

## Frontend architecture

- React app shell for dashboard experiences
- Tailwind styling with a dark finance command-center aesthetic
- Router-based navigation for multi-page product experiences

## Core principles

- Deterministic calculations before AI summarization
- Safe external dependency management
- Secure authorization boundaries per user
- Product features built in a staged versioned roadmap
