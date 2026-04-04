import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Client non trouvé' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = createServiceClient();

    // Only allow updating specific fields
    const allowedFields = ['name', 'phone', 'whatsapp', 'email'];
    const sanitizedBody: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) {
        sanitizedBody[key] = body[key];
      }
    }

    if (Object.keys(sanitizedBody).length === 0) {
      return NextResponse.json(
        { error: 'Aucun champ valide à mettre à jour.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('customers')
      .update(sanitizedBody)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
