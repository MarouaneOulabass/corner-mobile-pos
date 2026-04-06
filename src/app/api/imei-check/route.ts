import { NextRequest, NextResponse } from 'next/server';
import { validateIMEI } from '@/lib/utils';
import { checkIMEIBlacklist } from '@/lib/imei-check';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imei = searchParams.get('imei');

    if (!imei) {
      return NextResponse.json({ error: 'IMEI requis' }, { status: 400 });
    }

    // Validate IMEI format (Luhn)
    if (!validateIMEI(imei)) {
      return NextResponse.json(
        { error: 'IMEI invalide (format ou vérification Luhn échouée)' },
        { status: 400 }
      );
    }

    // Check blacklist
    const result = await checkIMEIBlacklist(imei);

    return NextResponse.json({
      imei,
      clean: result.clean,
      source: result.source,
      details: result.details || null,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
