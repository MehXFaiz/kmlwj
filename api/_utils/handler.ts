import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ZodError } from 'zod';
import { logger } from './logger';

type ServerlessFunction = (req: any, res: any) => Promise<any>;

/**
 * Wraps a Vercel serverless function handler to handle CORS, standard errors, 
 * Zod validation errors, and requests log.
 */
export function makeHandler(fn: ServerlessFunction) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
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
      const message = error.message || 'Internal Server Error';

      logger.error({
        err: {
          message: error.message,
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
        },
      });
    }
  };
}
