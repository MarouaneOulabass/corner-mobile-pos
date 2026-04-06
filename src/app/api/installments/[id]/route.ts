import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: plan, error } = await supabase
      .from('installment_plans')
      .select('*, customer:customers(*), sale:sales(id, total, created_at, payment_method)')
      .eq('id', id)
      .single();

    if (error || !plan) {
      return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });
    }

    // Fetch all payments
    const { data: payments } = await supabase
      .from('installment_payments')
      .select('*, receiver:users(id, name, role, email)')
      .eq('plan_id', id)
      .order('created_at', { ascending: true });

    return NextResponse.json({ ...plan, payments: payments || [] });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action !== 'pay') {
      return NextResponse.json({ error: 'Action invalide. Utilisez ?action=pay' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const body = await request.json();

    const userId = request.headers.get('x-user-id');
    const storeId = request.headers.get('x-user-store');

    if (!userId || !storeId) {
      return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
    }

    // Validate
    if (body.amount == null || body.amount <= 0) {
      return NextResponse.json({ error: 'Montant requis et doit etre > 0' }, { status: 400 });
    }

    const validMethods = ['cash', 'card', 'virement'];
    if (!body.payment_method || !validMethods.includes(body.payment_method)) {
      return NextResponse.json({ error: 'Methode de paiement invalide' }, { status: 400 });
    }

    // Fetch plan
    const { data: plan, error: planErr } = await supabase
      .from('installment_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (planErr || !plan) {
      return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });
    }

    if (plan.status !== 'active') {
      return NextResponse.json({ error: 'Ce plan n\'est plus actif' }, { status: 400 });
    }

    if (body.amount > plan.remaining_amount + 0.01) {
      return NextResponse.json({ error: 'Le montant depasse le solde restant' }, { status: 400 });
    }

    // Count existing payments to determine payment_number
    const { count: paymentCount } = await supabase
      .from('installment_payments')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', id);

    const paymentNumber = (paymentCount || 0) + 1;

    // Create payment record
    const { data: payment, error: payErr } = await supabase
      .from('installment_payments')
      .insert({
        plan_id: id,
        amount: body.amount,
        payment_method: body.payment_method,
        received_by: userId,
        payment_number: paymentNumber,
        notes: body.notes || null,
      })
      .select('*')
      .single();

    if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });

    // Update plan
    const newRemaining = Math.round((plan.remaining_amount - body.amount) * 100) / 100;
    const isCompleted = newRemaining <= 0;

    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 30);

    const updateData: Record<string, unknown> = {
      remaining_amount: Math.max(0, newRemaining),
    };

    if (isCompleted) {
      updateData.status = 'completed';
      updateData.next_due_date = null;
    } else {
      updateData.next_due_date = nextDue.toISOString().split('T')[0];
    }

    await supabase
      .from('installment_plans')
      .update(updateData)
      .eq('id', id);

    void journalWrite({
      event_type: 'installment_payment_received',
      entity_id: payment.id,
      entity_type: 'installment',
      user_id: userId,
      store_id: storeId,
      data: { payment, plan_id: id, remaining: Math.max(0, newRemaining), completed: isCompleted },
    });

    return NextResponse.json({ payment, remaining_amount: Math.max(0, newRemaining), completed: isCompleted }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const body = await request.json();

    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
    }

    const validStatuses = ['cancelled', 'defaulted'];
    if (!body.status || !validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Statut invalide. Valeurs: cancelled, defaulted' }, { status: 400 });
    }

    const { data: plan, error: fetchErr } = await supabase
      .from('installment_plans')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchErr || !plan) {
      return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });
    }

    if (plan.status === 'completed') {
      return NextResponse.json({ error: 'Impossible de modifier un plan termine' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('installment_plans')
      .update({ status: body.status, notes: body.notes || undefined })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
