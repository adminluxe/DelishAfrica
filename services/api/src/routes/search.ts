import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

const STAGING_PREFIX = process.env.SEARCH_PREFIX || 'DELISHAFRICA STAGING';
type Scope = 'merchants' | 'items' | 'all';

router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').trim();
    const scope = (String(req.query.scope || 'all') as Scope);
    const limit  = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 100);
    const offset = parseInt(String(req.query.offset || '0'), 10) || 0;
    const prefix = String(req.query.prefix || STAGING_PREFIX);
    if (!q) return res.status(400).json({ error: 'Missing query param q' });

    const out: Record<string, unknown> = {};

    if (scope === 'merchants' || scope === 'all') {
      const merchants = await prisma.$queryRaw<
        { id: string; name: string; address: string | null; phone: string | null; score: number }[]
      >(Prisma.sql`SELECT * FROM public.search_merchants(${prefix}, ${q}, ${limit}, ${offset});`);
      out.merchants = merchants;
    }

    if (scope === 'items' || scope === 'all') {
      const items = await prisma.$queryRaw<
        { merchant_id: string; merchant_name: string; item_id: string; item_name: string; price: number; image_url: string | null; score: number }[]
      >(Prisma.sql`SELECT * FROM public.search_items(${prefix}, ${q}, ${limit}, ${offset});`);
      out.items = items;
    }

    res.json({ q, scope, limit, offset, prefix, ...out });
  } catch (e) {
    console.error('Search error', e);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
