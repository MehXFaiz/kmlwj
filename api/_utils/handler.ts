import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ZodError } from 'zod';
import { logger } from './logger.js';

type ServerlessFunction = (req: any, res: any) => Promise<any>;

/**
 * Wraps a Vercel serverless function handler to handle CORS, standard errors, 
 * Zod validation errors, and requests log.
 */
export function makeHandler(fn: ServerlessFunction) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    try {
      await fn(req, res);
    } catch (error: any) {
      if (error instanceof ZodError || error.name === 'ZodError' || error.errors) {
        return res.status(400).json({
          error: {
            message: 'Validation failed',
            status: 400,
            details: error.errors?.map((err: any) => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          },
        });
      }

      const status = error.status || 500;
      const isProduction = process.env.NODE_ENV === 'production';
      // Errors thrown deliberately by application code (status < 500, e.g. validation/not-found)
      // always carry a message meant for the user. Anything that fell through uncaught to here
      // (status 500 by default) is an internal failure — in production its message can contain
      // raw Prisma/Postgres internals, file paths, and stack details, so it's masked from the
      // client there. In development, the real message (and code, for OS-level errors like EROFS/
      // EACCES) is surfaced directly so failures can be diagnosed without digging through logs.
      const message = status < 500 || !isProduction
        ? (error.message || 'Request failed')
        : 'An unexpected error occurred. Please try again or contact support if the problem persists.';

      logger.error({
        err: {
          message: error.message,
          code: error.code,
          stack: error.stack,
          status,
        },
        req: {
          method: req.method,
          url: req.url,
        },
      }, 'Request error');

      return res.status(status).json({
        error: {
          message,
          status,
          ...(!!error.code && !isProduction ? { code: error.code } : {}),
        },
      });
    }
  };
}
