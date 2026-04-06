import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { runAllChecks } from '@/lib/automation';

/**
 * Run automation checks across all stores.
 * Can be triggered by:
 * - Vercel cron (GET)
 * - Manual trigger from admin UI (POST)
 */

async function executeAutomation() {
  const supabase = createServiceClient();

  // Get all stores
  const { data: stores, error } = await supabase.from('stores').select('id, name');

  if (error || !stores) {
    return NextResponse.json({ error: 'Impossible de charger les magasins' }, { status: 500 });
  }

  const results: Array<{ store_id: string; store_name: string; alerts: number; notifications_created: number }> = [];
  let totalAlerts = 0;
  let totalCreated = 0;

  for (const store of stores) {
    try {
      const result = await runAllChecks(store.id);
      results.push({
        store_id: store.id,
        store_name: store.name,
        ...result,
      });
      totalAlerts += result.alerts;
      totalCreated += result.notifications_created;
    } catch (err) {
      results.push({
        store_id: store.id,
        store_name: store.name,
        alerts: 0,
        notifications_created: 0,
      });
      // Log error but continue with other stores
      console.error(`Automation error for store ${store.name}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    ran_at: new Date().toISOString(),
    total_alerts: totalAlerts,
    total_notifications_created: totalCreated,
    stores: results,
  });
}

// GET — for Vercel cron job compatibility
export async function GET() {
  return executeAutomation();
}

// POST — for manual trigger from admin UI
export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  const userRole = req.headers.get('x-user-role');

  // Only superadmin and manager can trigger manually
  if (!userId || (userRole !== 'superadmin' && userRole !== 'manager')) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 });
  }

  return executeAutomation();
}
