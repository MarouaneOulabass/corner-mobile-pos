import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('returns')
      .select(
        '*, sale:sales(id, total, created_at, discount_amount, payment_method, seller:users!sales_seller_id_fkey(id, name), items:sale_items(*, product:products(id, brand, model, imei, product_type, selling_price))), customer:customers(id, name, phone, email, store_credit), processor:users!returns_processed_by_fkey(id, name), items:return_items(*, product:products(id, brand, model, imei, product_type))'
      )
      .eq('id', params.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Retour introuvable' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
