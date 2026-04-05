import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPhone = searchParams.get('phone');

    if (!rawPhone) {
      return NextResponse.json(
        { error: 'Numéro de téléphone requis' },
        { status: 400 }
      );
    }

    // Sanitize phone: keep only digits, optional leading +
    const phone = rawPhone.replace(/[^0-9+]/g, '').replace(/(?!^)\+/g, '');

    if (phone.length < 8 || phone.length > 15) {
      return NextResponse.json(
        { error: 'Numéro de téléphone invalide' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Find customer by phone
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    if (customerError) {
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

    if (!customer) {
      return NextResponse.json({ repairs: [] });
    }

    // Fetch repairs for this customer
    const { data: repairs, error: repairsError } = await supabase
      .from('repairs')
      .select('id, device_brand, device_model, problem, status, estimated_cost, final_cost, deposit, estimated_completion_date, created_at, updated_at, technician:users(name)')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });

    if (repairsError) {
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

    if (!repairs || repairs.length === 0) {
      return NextResponse.json({ repairs: [] });
    }

    // Fetch status logs for all repairs
    const repairIds = repairs.map((r) => r.id);
    const { data: logs } = await supabase
      .from('repair_status_log')
      .select('repair_id, status, changed_at, notes')
      .in('repair_id', repairIds)
      .order('changed_at', { ascending: true });

    // Group logs by repair_id
    const logsByRepair: Record<string, typeof logs> = {};
    if (logs) {
      for (const log of logs) {
        if (!logsByRepair[log.repair_id]) {
          logsByRepair[log.repair_id] = [];
        }
        logsByRepair[log.repair_id]!.push(log);
      }
    }

    // Build safe response
    const result = repairs.map((repair) => ({
      id: repair.id,
      device_brand: repair.device_brand,
      device_model: repair.device_model,
      problem: repair.problem,
      status: repair.status,
      estimated_cost: repair.estimated_cost,
      final_cost: repair.final_cost,
      deposit: repair.deposit,
      estimated_completion_date: repair.estimated_completion_date,
      created_at: repair.created_at,
      updated_at: repair.updated_at,
      technician_name: (repair.technician as unknown as { name: string } | null)?.name || null,
      status_logs: (logsByRepair[repair.id] || []).map((log) => ({
        status: log.status,
        changed_at: log.changed_at,
        notes: log.notes,
      })),
    }));

    return NextResponse.json({ repairs: result });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
