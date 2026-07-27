import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { registerSchema } from '../_schemas/auth.schema.js';
import * as authService from '../_services/auth.service.js';

export default makeHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
  }

  const validatedData = registerSchema.parse(req.body);
  const user = await authService.register(validatedData);

  return res.status(201).json({
    status: 201,
    message: 'Registration successful',
    user,
  });
});
