#!/bin/sh
# Production startup: self-initialize the database, then boot the API.
# Needed because Render's free tier has no Shell / pre-deploy commands,
# so `prisma db push` + seed cannot be run manually. All steps are
# idempotent and safe to re-run on every deploy/boot.
set -e

echo "==> Ensuring PostGIS extension..."
node -e 'const{Client}=require("pg");(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();await c.query("CREATE EXTENSION IF NOT EXISTS postgis");await c.end();console.log("postgis ok")})().catch(e=>{console.error("postgis failed:",e.message);process.exit(1)})'

echo "==> Syncing Prisma schema..."
npx prisma db push

echo "==> Seeding admin user..."
npx prisma db seed || echo "seed skipped (likely already seeded)"

echo "==> Starting API..."
exec node dist/main.js
