
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { AccountingIntegrityService } from '../_services/accounting-integrity.service.js';

export default makeHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  try {
    const result = await AccountingIntegrityService.runFullCheck();
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({
      error: {
        message: 'Failed to run accounting integrity check',
        details: error?.message,
        status: 500,
      },
    });
  }
});
