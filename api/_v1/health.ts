import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { prisma, pool } from '../_prisma.js';

export default makeHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  try {
    // 1. Verify raw PostgreSQL connection
    await pool.query('SELECT 1');

    // 2. Verify Prisma connection
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      success: true,
      database: 'connected',
      server: 'running',
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      database: 'disconnected',
      server: 'running',
      error: error?.message || 'Database check failed',
    });
  }
});
