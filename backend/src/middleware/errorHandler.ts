import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
    status?: number;
    code?: string;
}

/**
 * Global error handler middleware.
 * Must be registered AFTER all routes.
 */
export const errorHandler = (
    err: AppError,
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';

    // Don't expose stack traces in production
    const response: Record<string, any> = {
        status: 'error',
        message,
        code: err.code || 'INTERNAL_ERROR',
    };

    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    console.error(`[ERROR] ${status} - ${message}`, {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
    });

    res.status(status).json(response);
};

/**
 * 404 handler — catches any unmatched routes
 */
export const notFound = (req: Request, res: Response, next: NextFunction) => {
    const err: AppError = new Error(`Route not found: ${req.originalUrl}`);
    err.status = 404;
    err.code = 'NOT_FOUND';
    next(err);
};
