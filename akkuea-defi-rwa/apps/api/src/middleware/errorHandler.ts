import { Elysia } from 'elysia';
import { ApiError } from '../errors/ApiError';

function isApiErrorLike(e: unknown): e is { statusCode: number; code: string; message: string } {
  return (
    typeof e === 'object' &&
    e !== null &&
    'statusCode' in e &&
    'code' in e &&
    typeof (e as { statusCode: unknown }).statusCode === 'number' &&
    typeof (e as { code: unknown }).code === 'string'
  );
}

export const errorHandler = new Elysia().onError({ as: 'global' }, ({ error, code, set }) => {
  // Handle custom ApiError instances (including duck-typed for cross-module tests)
  if (error instanceof ApiError || isApiErrorLike(error)) {
    const err = error as {
      statusCode: number;
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };
    set.status = err.statusCode;
    return {
      success: false,
      error: err.code,
      message: err.message,
      ...(err.details && { details: err.details }),
      timestamp: new Date().toISOString(),
    };
  }

  if (code === 'VALIDATION') {
    set.status = 400;
    return {
      success: false,
      error: 'Validation Error',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };
  }

  if (code === 'NOT_FOUND') {
    set.status = 404;
    return {
      success: false,
      error: 'Not Found',
      message: 'The requested resource was not found',
      timestamp: new Date().toISOString(),
    };
  }

  if (code === 'INTERNAL_SERVER_ERROR') {
    set.status = 500;
    return {
      success: false,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    };
  }

  // Default error handler
  set.status = 500;
  return {
    success: false,
    error: 'Server Error',
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  };
});
