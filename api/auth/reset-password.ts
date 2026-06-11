import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { makeHandler } from '../_utils/handler.js';
import * as authService from '../_services/auth.service.js';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

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
