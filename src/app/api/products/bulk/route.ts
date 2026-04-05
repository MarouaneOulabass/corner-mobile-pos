import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { validateIMEI } from '@/lib/utils';
import { journalWriteBatch } from '@/lib/backup';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const storeId = request.headers.get('x-user-store');
    const userId = request.headers.get('x-user-id');

    if (!body.products || !Array.isArray(body.products) || body.products.length === 0) {
      return NextResponse.json(
        { error: 'Le champ products est requis et doit etre un tableau non vide' },
        { status: 400 }
      );
    }

    const required = ['product_type', 'brand', 'model', 'condition', 'purchase_price', 'selling_price'] as const;
    const errors: { row: number; error: string }[] = [];
    const validProducts: Record<string, unknown>[] = [];

    // Collect all IMEIs in the batch for intra-batch uniqueness check
    const batchIMEIs = new Map<string, number>(); // imei -> first row index

    // Phase 1: validate all products
    for (let i = 0; i < body.products.length; i++) {
      const p = body.products[i];
      const rowNum = i + 1;

      // Check required fields
      const missing = required.filter((f) => !p[f] && p[f] !== 0);
      if (missing.length > 0) {
        errors.push({ row: rowNum, error: `Champs requis manquants: ${missing.join(', ')}` });
        continue;
      }

      // Validate IMEI format for phones
      if (p.imei && p.product_type === 'phone') {
        if (!validateIMEI(p.imei)) {
          errors.push({ row: rowNum, error: 'IMEI invalide' });
          continue;
        }
      }

      // Check intra-batch IMEI uniqueness
      if (p.imei) {
        const existingRow = batchIMEIs.get(p.imei);
        if (existingRow !== undefined) {
          errors.push({ row: rowNum, error: `IMEI en double avec la ligne ${existingRow}` });
          continue;
        }
        batchIMEIs.set(p.imei, rowNum);
      }

      validProducts.push({
        product_type: p.product_type,
        brand: p.brand,
        model: p.model,
        storage: p.storage || null,
        color: p.color || null,
        condition: p.condition,
        purchase_price: p.purchase_price,
        selling_price: p.selling_price,
        imei: p.imei || null,
        supplier: p.supplier || null,
        notes: p.notes || null,
        purchase_date: p.purchase_date || null,
        store_id: p.store_id || storeId,
        status: 'in_stock',
        created_by: p.created_by || userId,
        _rowNum: i + 1, // track original row for error reporting
      });
    }

    // Phase 2: check IMEI uniqueness against DB for all valid products with IMEIs
    const imeisToCheck = validProducts
      .filter((p) => p.imei)
      .map((p) => p.imei as string);

    if (imeisToCheck.length > 0) {
      const { data: existingProducts } = await supabase
        .from('products')
        .select('imei')
        .in('imei', imeisToCheck);

      if (existingProducts && existingProducts.length > 0) {
        const existingIMEIs = new Set(existingProducts.map((p: { imei: string }) => p.imei));
        // Remove products with duplicate IMEIs and add errors
        const toRemove = new Set<number>();
        for (const p of validProducts) {
          if (p.imei && existingIMEIs.has(p.imei as string)) {
            errors.push({ row: p._rowNum as number, error: 'Un produit avec cet IMEI existe deja en base' });
            toRemove.add(p._rowNum as number);
          }
        }
        // Filter out invalid ones
        for (let i = validProducts.length - 1; i >= 0; i--) {
          if (toRemove.has(validProducts[i]._rowNum as number)) {
            validProducts.splice(i, 1);
          }
        }
      }
    }

    // Phase 3: batch insert valid products
    let imported = 0;
    if (validProducts.length > 0) {
      // Remove internal _rowNum before inserting
      const insertData = validProducts.map(({ _rowNum, ...rest }) => rest);

      const { data, error } = await supabase
        .from('products')
        .insert(insertData)
        .select('id');

      if (error) {
        return NextResponse.json(
          { imported: 0, errors: [{ row: 0, error: error.message }] },
          { status: 500 }
        );
      }

      imported = data?.length || 0;

      if (data && data.length > 0) {
        void journalWriteBatch(data.map((p, i) => ({ event_type: 'product_created' as const, entity_id: p.id, entity_type: 'product' as const, user_id: userId || 'unknown', store_id: (insertData[i]?.store_id as string) || storeId || 'unknown', data: { ...insertData[i], id: p.id } })));
      }
    }

    return NextResponse.json({ imported, errors }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
