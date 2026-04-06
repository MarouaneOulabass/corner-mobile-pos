import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { SignJWT } from 'jose';

function getJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('NEXTAUTH_SECRET must be set and at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const { phone } = body;

    if (!phone) {
      return NextResponse.json({ error: 'Numero de telephone requis' }, { status: 400 });
    }

    const cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned.length < 8) {
      return NextResponse.json(
        { error: 'Numero de telephone invalide' },
        { status: 400 }
      );
    }

    // Look up customer by phone
    const { data: customers, error: custErr } = await supabase
      .from('customers')
      .select('id, name, phone, whatsapp, email, loyalty_tier, loyalty_points')
      .or(`phone.ilike.%${cleaned}%,whatsapp.ilike.%${cleaned}%`);

    if (custErr) {
      return NextResponse.json({ error: 'Erreur de recherche' }, { status: 500 });
    }

    if (!customers || customers.length === 0) {
      return NextResponse.json(
        { error: 'Aucun compte trouve avec ce numero. Contactez le magasin.' },
        { status: 404 }
      );
    }

    const customer = customers[0];

    // Generate simple portal token (JWT with customer_id, no role)
    const token = await new SignJWT({
      sub: customer.id,
      type: 'portal',
      name: customer.name,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(getJwtSecret());

    return NextResponse.json({
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        loyalty_tier: customer.loyalty_tier || 'bronze',
        loyalty_points: customer.loyalty_points || 0,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
