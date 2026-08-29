import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from './_utils/handler.js';
import { prisma } from './_prisma.js';
import { logger } from './_utils/logger.js';

export default makeHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;

    // Verify admin user presence safely without leaking passwords or tokens
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@erp.com' },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        role: { select: { name: true } },
      },
    }).catch(() => null);

    return res.status(200).json({
      success: true,
      database: 'connected',
      adminUserExists: Boolean(adminUser),
      adminRole: adminUser?.role?.name || null,
    });
  } catch (err: any) {
    logger.error({ error: err?.message }, 'GoDaddy MySQL database probe failed');
    return res.status(503).json({
      success: false,
      database: 'disconnected',
      error: 'Database connection failed. Please verify MySQL configuration.',
    });
  }
});
