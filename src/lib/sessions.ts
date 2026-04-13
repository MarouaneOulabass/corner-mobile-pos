import { createServiceClient } from './supabase';

export interface Session {
  id: string;
  user_id: string;
  jti: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

// ─── Create Session ─────────────────────────────────────────────────────

export async function createSession(
  userId: string,
  ip: string,
  userAgent: string,
  expiresAt: Date
): Promise<{ jti: string; sessionId: string }> {
  const supabase = createServiceClient();
  const jti = crypto.randomUUID();

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      jti,
      ip_address: ip,
      user_agent: userAgent.slice(0, 512), // truncate long UAs
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create session: ${error?.message ?? 'unknown error'}`);
  }

  return { jti, sessionId: data.id };
}

// ─── Verify Session ─────────────────────────────────────────────────────

export async function verifySession(jti: string): Promise<Session | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('jti', jti)
    .is('revoked_at', null)
    .single();

  if (error || !data) return null;

  // Check expiry
  if (new Date(data.expires_at) < new Date()) {
    return null;
  }

  return data as Session;
}

// ─── Revoke Session ─────────────────────────────────────────────────────

export async function revokeSession(jti: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('jti', jti)
    .is('revoked_at', null);

  return !error;
}

// ─── Revoke All Sessions ────────────────────────────────────────────────

export async function revokeAllSessions(
  userId: string,
  exceptJti?: string
): Promise<boolean> {
  const supabase = createServiceClient();

  let query = supabase
    .from('sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null);

  if (exceptJti) {
    query = query.neq('jti', exceptJti);
  }

  const { error } = await query;
  return !error;
}

// ─── Cleanup Expired Sessions ───────────────────────────────────────────

export async function cleanupExpiredSessions(): Promise<number> {
  const supabase = createServiceClient();

  // Delete sessions that expired more than 24 hours ago
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('sessions')
    .delete()
    .lt('expires_at', cutoff)
    .select('id');

  if (error) {
    throw new Error(`Failed to cleanup sessions: ${error.message}`);
  }

  return data?.length ?? 0;
}

// ─── List Active Sessions ───────────────────────────────────────────────

export async function listActiveSessions(userId: string): Promise<Session[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list sessions: ${error.message}`);
  }

  return (data ?? []) as Session[];
}
