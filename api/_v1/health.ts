import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { prisma, pool, getDatabaseUrl, getDatabaseType } from '../_prisma.js';

export default makeHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  const dbUrl = getDatabaseUrl();
  const dbType = getDatabaseType();
  const maskedDbUrl = dbUrl ? dbUrl.replace(/:([^:@]+)@/, ':****@') : 'NOT_CONFIGURED';

  try {
    let poolStatus = 'not_configured';
    if (pool) {
      await pool.query('SELECT 1');
      poolStatus = 'connected';
    }

    await prisma.$queryRaw`SELECT 1`;
    const userCount = await prisma.user.count().catch(() => -1);

    return res.status(200).json({
      success: true,
      status: 'ok',
      database: 'connected',
      dialect: dbType,
      poolStatus,
      target: maskedDbUrl,
      usersInDb: userCount,
      server: 'running',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(503).json({
      success: false,
      status: 'error',
      database: 'disconnected',
      dialect: dbType,
      target: maskedDbUrl,
      error: error?.message || 'Database connection probe failed',
      server: 'running',
      timestamp: new Date().toISOString(),
    });
  }
});
