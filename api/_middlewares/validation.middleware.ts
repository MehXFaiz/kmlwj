import { ZodSchema, ZodError } from 'zod';

export interface ValidationTargetSchemas {
  body?: ZodSchema<any>;
  query?: ZodSchema<any>;
  params?: ZodSchema<any>;
}

/**
 * Validates request data (body, query, params) against Zod schemas.
 * Replaces req.body, req.query, req.params with sanitized & parsed values.
 * Throws ZodError on failure, which is caught and formatted by makeHandler or errorHandler.
 */
export function validateRequest(schemas: ValidationTargetSchemas) {
  return (req: any, res: any, next?: any) => {
    if (schemas.body && req.body !== undefined) {
      req.body = schemas.body.parse(req.body);
    }
    if (schemas.query && req.query !== undefined) {
      req.query = schemas.query.parse(req.query);
    }
    if (schemas.params && req.params !== undefined) {
      req.params = schemas.params.parse(req.params);
    }
    if (typeof next === 'function') {
      next();
    }
  };
}

/**
 * Validates data against a Zod schema and returns parsed result.
 * Throws ZodError on validation failure.
 */
export function validateData<T>(schema: ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Formats a ZodError into standardized error details format.
 */
export function formatZodError(error: ZodError) {
  return {
    error: {
      message: 'Validation failed',
      status: 400,
      details: error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    },
  };
}
