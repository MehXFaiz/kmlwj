import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from './_utils/handler';

export default makeHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  return res.status(200).json({
    status: 'OK',
    timestamp: new Date(),
  });
});
