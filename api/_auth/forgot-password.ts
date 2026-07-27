import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { forgotPasswordSchema } from '../_schemas/auth.schema.js';
import * as authService from '../_services/auth.service.js';

export default makeHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  const validatedData = forgotPasswordSchema.parse(req.body);
  await authService.forgotPassword(validatedData.email);

  return res.status(200).json({
    status: 200,
    message: 'If the email exists, a password reset link has been generated and printed to server logs.',
  });
});
