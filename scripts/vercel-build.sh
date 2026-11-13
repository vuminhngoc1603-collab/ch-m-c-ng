#!/bin/sh
# Build trên Vercel: tạo bảng, nạp dữ liệu mặc định, rồi build Next.js.
# Hỗ trợ cả Neon (có DATABASE_URL_UNPOOLED) lẫn Prisma Postgres (chỉ có DATABASE_URL).
set -e
export DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}"
npx prisma generate
npx prisma migrate deploy
npx tsx prisma/seed.ts
npx next build
