import pino from 'pino';
import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  ...(isProduction
    ? {
        formatters: {
          level(label: string) {
            return { level: label };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }
    : {
        transport: {
          target: 'pino/file',
          options: { destination: 1 }, // stdout
        },
        formatters: {
          level(label: string) {
            return { level: label };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
});

/**
 * Creates a child logger enriched with request context.
 * Extracts request_id from x-request-id header or generates a UUID.
 */
export function createRequestLogger(req: NextRequest): pino.Logger {
  const requestId =
    req.headers.get('x-request-id') || uuidv4();

  const url = new URL(req.url);

  return logger.child({
    request_id: requestId,
    method: req.method,
    url: url.pathname,
    user_agent: req.headers.get('user-agent') || undefined,
  });
}
