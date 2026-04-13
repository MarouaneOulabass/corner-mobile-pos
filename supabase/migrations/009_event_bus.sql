-- Corner Mobile — Migration 009: Internal Event Bus
--
-- Creates the events_log table for the internal event bus system.
-- Events are published by modules and processed asynchronously by handlers.
-- Service role and superadmin access only (events are internal).

CREATE TABLE IF NOT EXISTS events_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  source_module TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  error TEXT
);

CREATE INDEX idx_events_pending ON events_log(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_events_type ON events_log(event_type);
CREATE INDEX idx_events_org ON events_log(organization_id);

ALTER TABLE events_log ENABLE ROW LEVEL SECURITY;
-- Service role only (events are internal)
CREATE POLICY "events_log_service" ON events_log FOR ALL TO authenticated
  USING (auth_role_claim() IN ('superadmin'));
CREATE POLICY "events_log_insert" ON events_log FOR INSERT TO authenticated
  WITH CHECK (true);
