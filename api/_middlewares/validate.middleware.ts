import { ZodSchema, ZodError } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: any, res: any, next: any): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: {
            message: 'Validation failed',
            status: 400,
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          },
        });
        return;
      }
      next(error);
    }
  };
}
