import { NextRequest, NextResponse } from 'next/server';
import { initializeEventHandlers } from '@/modules/core/services/event-handlers-registry';
import { processEvents } from '@/modules/core/services/event-handlers';

// Initialize handlers once on module load
let initialized = false;
function ensureInitialized() {
  if (!initialized) {
    initializeEventHandlers();
    initialized = true;
  }
}

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  // Auth: superadmin via middleware headers OR cron secret header
  const role = req.headers.get('x-user-role');
  const cronSecret = req.headers.get('x-cron-secret');

  const isSuperadmin = role === 'superadmin';
  const isValidCron = CRON_SECRET && cronSecret === CRON_SECRET;

  if (!isSuperadmin && !isValidCron) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  try {
    ensureInitialized();
    const count = await processEvents();
    return NextResponse.json({ processed: count });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[EventBus] Processing error:', message);
    return NextResponse.json({ error: 'Event processing failed', details: message }, { status: 500 });
  }
}
