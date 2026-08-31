import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ZodError } from 'zod';
import { logger } from './logger.js';
import { serializeMoney } from './money.js';
import { prisma } from '../_prisma.js';

type ServerlessFunction = (req: any, res: any) => Promise<any>;

function isTransientDbError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  const code = err.code || '';
  return (
    msg.includes('10054') ||
    msg.includes('connection was forcibly closed') ||
    msg.includes('connection closed') ||
    msg.includes('socket closed') ||
    msg.includes('server selection timed out') ||
    msg.includes('pool was destroyed') ||
    code === 'P1001' ||
    code === 'P1017'
  );
}

/**
 * Wraps a Vercel serverless function handler to handle CORS, standard errors,
 * Zod validation errors, transient DB retries, and request logs.
 */
export function makeHandler(fn: ServerlessFunction) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const sendJson = res.json.bind(res);
    (res as any).json = (body: any) => sendJson(serializeMoney(body));

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
    } catch (firstError: any) {
      // Automatic retry for transient remote connection drops (e.g. Atlas idle disconnect os error 10054)
      if (isTransientDbError(firstError) && !res.headersSent) {
        logger.warn({ error: firstError.message }, 'Transient database connection drop detected, attempting reconnect and retry...');
        try {
          await prisma.$connect();
          await fn(req, res);
          return;
        } catch (retryError: any) {
          logger.error({ error: retryError.message }, 'Database retry attempt failed.');
          // Fall through to error handler using retryError
        }
      }

      const error = firstError;
      if (res.headersSent) return;

      if (error instanceof ZodError || error.name === 'ZodError' || error.errors) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
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
        success: false,
        message,
        error: {
          message,
          status,
          ...(!!error.code && !isProduction ? { code: error.code } : {}),
        },
      });
    }
  };
}
