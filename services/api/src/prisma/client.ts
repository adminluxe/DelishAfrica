import { PrismaClient } from '@prisma/client';

// Force l'URL depuis l'env du process (celle que ton Makefile charge depuis .env.local)
export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});
