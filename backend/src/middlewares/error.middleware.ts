import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface HttpError extends Error {
  status?: number;
  message: string;
}

export function errorHandler(
  err: HttpError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  logger.error({
    err: {
      message: err.message,
      stack: err.stack,
      status,
    },
    req: {
      method: req.method,
      url: req.url,
    },
  }, 'Request error');

  res.status(status).json({
    error: {
      message,
      status,
    },
  });
}
