import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getAuthContext } from '@/lib/auth';
import { getJournalEntries } from '@/modules/accounting/services/journal-service';

export async function GET(request: NextRequest) {
  try {
    const { orgId } = getAuthContext(request);
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (code) {
      // Return entries for a specific journal
      const entries = await getJournalEntries(orgId, { journalCode: code });
      return NextResponse.json({ entries });
    }

    // List all journals
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('journals')
      .select('*')
      .eq('organization_id', orgId)
      .order('code', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ journals: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    const status = message.includes('authentication') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
