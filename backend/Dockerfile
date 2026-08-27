FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/
RUN npm ci
COPY backend backend
RUN npm --workspace backend run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/
RUN npm ci --omit=dev
COPY --from=build /app/backend/dist backend/dist
EXPOSE 5000
CMD ["node", "backend/dist/server.js"]
