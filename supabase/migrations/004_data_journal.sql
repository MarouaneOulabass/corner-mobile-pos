-- Data Journal — append-only event log for disaster recovery
-- Every critical operation is double-written here as a JSON event.
-- This table is the single source of truth for replaying operations.

CREATE TABLE IF NOT EXISTS data_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'sale', 'repair', 'transfer', 'customer', 'user')),
  user_id UUID NOT NULL,
  store_id UUID,
  data JSONB NOT NULL DEFAULT '{}',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_journal_entity ON data_journal(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_journal_event_type ON data_journal(event_type);
CREATE INDEX IF NOT EXISTS idx_journal_created_at ON data_journal(created_at);
CREATE INDEX IF NOT EXISTS idx_journal_store ON data_journal(store_id);
CREATE INDEX IF NOT EXISTS idx_journal_user ON data_journal(user_id);

-- This table should NEVER be truncated or have rows deleted.
-- It is append-only by design.
