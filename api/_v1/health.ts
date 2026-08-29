import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { prisma } from '../_prisma.js';

export default makeHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  try {
    // Verify Prisma connection
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      success: true,
      status: 'ok',
      database: 'connected',
      server: 'running',
    });
  } catch (error: any) {
    return res.status(503).json({
      success: false,
      status: 'error',
      database: 'disconnected',
      server: 'running',
    });
  }
});
