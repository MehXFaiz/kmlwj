import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from './_utils/handler.js';
import { prisma } from './_prisma.js';
import { logger } from './_utils/logger.js';

export default makeHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  try {
    // Check Prisma ORM client connection
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      status: 'ok',
      database: 'connected',
    });
  } catch (err: any) {
    logger.error({ error: err?.message }, 'Health check database probe failed');
    return res.status(503).json({
      status: 'error',
      database: 'disconnected',
    });
  }
});
