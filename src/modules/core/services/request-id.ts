import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

/**
 * Reads the x-request-id header from the request, or generates a new UUID v4.
 */
export function getRequestId(req: NextRequest): string {
  return req.headers.get('x-request-id') || uuidv4();
}

type RouteHandler = (
  req: NextRequest,
  context?: unknown
) => Promise<NextResponse> | NextResponse;

/**
 * Higher-order function that wraps an API route handler to:
 * - Read or generate a request ID
 * - Inject x-request-id into the response headers
 */
export function withRequestId(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, context?: unknown) => {
    const requestId = getRequestId(req);

    const response = await handler(req, context);

    response.headers.set('x-request-id', requestId);

    return response;
  };
}
