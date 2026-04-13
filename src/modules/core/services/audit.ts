import { createServiceClient } from './supabase';
import { logger } from './logger';

export interface AuditLogParams {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * Insert an audit log entry. Fire-and-forget: errors are logged but not thrown.
 * Call without `await` in hot paths to avoid blocking the response.
 */
export function auditLog(params: AuditLogParams): void {
  const supabase = createServiceClient();

  const record = {
    user_id: params.userId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    before_data: params.before ?? null,
    after_data: params.after ?? null,
    ip_address: params.ip ?? null,
    user_agent: params.userAgent ?? null,
    request_id: params.requestId ?? null,
    created_at: new Date().toISOString(),
  };

  // Wrap in an async IIFE so we get a real Promise with .catch()
  (async () => {
    const { error } = await supabase.from('audit_log').insert(record);
    if (error) {
      logger.error(
        { err: error, audit: record },
        'Failed to insert audit log'
      );
    }
  })().catch((err: unknown) => {
    logger.error(
      { err, audit: record },
      'Unexpected error inserting audit log'
    );
  });
}
