import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { resetPasswordSchema } from '../_schemas/auth.schema.js';
import * as authService from '../_services/auth.service.js';

export default makeHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  const validatedData = resetPasswordSchema.parse(req.body);
  await authService.resetPassword(validatedData);

  return res.status(200).json({
    status: 200,
    message: 'Password has been reset successfully',
  });
});
