import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from './_utils/handler.js';
import { checkDatabaseConnection } from './_config/mongodb.js';

export default makeHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method Not Allowed',
      error: { message: 'Method Not Allowed', status: 405 },
    });
  }

  const result = await checkDatabaseConnection();

  if (result.success) {
    return res.status(200).json({
      success: true,
      database: 'connected',
    });
  }

  return res.status(503).json({
    success: false,
    database: 'disconnected',
    error: 'Database connection unavailable',
  });
});
