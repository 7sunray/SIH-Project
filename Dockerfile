FROM node:20-alpine AS builder
WORKDIR /app
# Build tools for native deps (bcrypt) + openssl for the prisma engines.
RUN apk add --no-cache python3 make g++ openssl
COPY package*.json ./
COPY .npmrc ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
# JWT signing keys are read from ./keys at startup (see AuthModule).
COPY --from=builder /app/keys ./keys
# Prisma schema/migrations/seed + config so `npx prisma migrate deploy`
# and `npx prisma db seed` work inside the container (Step 8.3).
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma7.config.ts /app/tsconfig.json ./
# Pinned to the lockfile versions; --ignore-scripts skips the root
# postinstall (client was already generated in the builder stage).
RUN npm install --no-save --ignore-scripts prisma@7.10.0 ts-node@10.9.2 typescript@6.0.3
EXPOSE 3000
CMD ["node", "dist/main.js"]
