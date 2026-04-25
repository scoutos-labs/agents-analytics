import type { Context } from 'hono';

export function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    console.error('[Error]', err.message, err.stack);
    return 'Internal error';
  }
  console.error('[Error]', err);
  return 'Internal error';
}
