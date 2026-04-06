import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { journalWrite } from '@/lib/backup';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const customer_id = searchParams.get('customer_id');

    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');
    const store_id = searchParams.get('store_id');

    let query = supabase
      .from('installment_plans')
      .select(
        '*, customer:customers(*), sale:sales(id, total, created_at, payment_method)',
        { count: 'exact' }
      );

    // Store scoping
    if (userRole !== 'superadmin' && userStore) {
      query = query.eq('store_id', userStore);
    } else if (store_id) {
      query = query.eq('store_id', store_id);
    }

    if (status) query = query.eq('status', status);
    if (customer_id) query = query.eq('customer_id', customer_id);

    query = query.order('created_at', { ascending: false });

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ plans: data || [], total: count || 0 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const userId = request.headers.get('x-user-id');
    const storeId = request.headers.get('x-user-store');

    if (!userId || !storeId) {
      return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
    }

    // Validate required fields
    if (!body.sale_id) {
      return NextResponse.json({ error: 'sale_id requis' }, { status: 400 });
    }
    if (!body.customer_id) {
      return NextResponse.json({ error: 'customer_id requis' }, { status: 400 });
    }
    if (body.total_amount == null || body.total_amount <= 0) {
      return NextResponse.json({ error: 'Montant total requis et doit etre > 0' }, { status: 400 });
    }
    if (body.down_payment == null || body.down_payment < 0) {
      return NextResponse.json({ error: 'Acompte doit etre >= 0' }, { status: 400 });
    }
    if (body.down_payment >= body.total_amount) {
      return NextResponse.json({ error: 'L\'acompte doit etre inferieur au montant total' }, { status: 400 });
    }
    if (!body.num_installments || body.num_installments < 1 || !Number.isInteger(body.num_installments)) {
      return NextResponse.json({ error: 'Nombre d\'echeances requis (entier >= 1)' }, { status: 400 });
    }

    const remainingAmount = Math.round((body.total_amount - body.down_payment) * 100) / 100;
    const installmentAmount = Math.round((remainingAmount / body.num_installments) * 100) / 100;

    // next_due_date = 30 days from now
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 30);

    const { data: plan, error } = await supabase
      .from('installment_plans')
      .insert({
        sale_id: body.sale_id,
        customer_id: body.customer_id,
        store_id: storeId,
        created_by: userId,
        total_amount: body.total_amount,
        down_payment: body.down_payment,
        remaining_amount: remainingAmount,
        num_installments: body.num_installments,
        installment_amount: installmentAmount,
        status: 'active',
        next_due_date: nextDue.toISOString().split('T')[0],
        notes: body.notes || null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void journalWrite({
      event_type: 'installment_plan_created',
      entity_id: plan.id,
      entity_type: 'installment',
      user_id: userId,
      store_id: storeId,
      data: plan,
    });

    return NextResponse.json(plan, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
