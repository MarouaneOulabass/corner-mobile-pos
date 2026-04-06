import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    const imei = searchParams.get('imei');
    const product_id = searchParams.get('product_id');

    if (!imei && !product_id) {
      return NextResponse.json({ error: 'imei ou product_id requis' }, { status: 400 });
    }

    // --- FIND PRODUCT ---
    let query = supabase
      .from('products')
      .select('id, imei, brand, model, storage, color, condition, purchase_price, selling_price, status, store_id, warranty_months, purchase_date, created_at');

    if (imei) {
      query = query.eq('imei', imei);
    } else {
      query = query.eq('id', product_id!);
    }

    const { data: product, error: prodError } = await query.single();

    if (prodError || !product) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }

    // --- CALCULATE WARRANTY ---
    const warrantyMonths = product.warranty_months || 0;
    const purchaseDate = product.purchase_date || product.created_at;
    let warrantyEndDate: string | null = null;
    let isUnderWarranty = false;

    if (warrantyMonths > 0 && purchaseDate) {
      const startDate = new Date(purchaseDate);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + warrantyMonths);
      warrantyEndDate = endDate.toISOString();
      isUnderWarranty = new Date() < endDate;
    }

    // --- CHECK SALE INFO (when was it sold to customer?) ---
    let saleInfo: { sale_date: string; customer_name?: string; sale_id: string } | null = null;

    const { data: saleItem } = await supabase
      .from('sale_items')
      .select('sale_id, sale:sales(id, created_at, customer:customers(id, name))')
      .eq('product_id', product.id)
      .limit(1)
      .maybeSingle();

    if (saleItem?.sale) {
      const sale = saleItem.sale as unknown as { id: string; created_at: string; customer?: { id: string; name: string } };
      saleInfo = {
        sale_id: sale.id,
        sale_date: sale.created_at,
        customer_name: sale.customer?.name,
      };

      // Recalculate warranty from sale date if product was sold
      if (warrantyMonths > 0) {
        const saleDateObj = new Date(sale.created_at);
        const saleEndDate = new Date(saleDateObj);
        saleEndDate.setMonth(saleEndDate.getMonth() + warrantyMonths);
        warrantyEndDate = saleEndDate.toISOString();
        isUnderWarranty = new Date() < saleEndDate;
      }
    }

    // --- CHECK REPAIR WARRANTY ---
    // If the product was repaired, check if the repair has its own warranty
    const repairs: { id: string; problem: string; final_cost: number; updated_at: string; repair_warranty_end?: string; repair_under_warranty?: boolean }[] = [];

    const { data: repairData } = await supabase
      .from('repairs')
      .select('id, problem, final_cost, status, updated_at')
      .eq('imei', product.imei || '')
      .eq('status', 'delivered')
      .order('updated_at', { ascending: false });

    if (repairData) {
      for (const repair of repairData) {
        // Standard 30-day repair warranty
        const repairDate = new Date(repair.updated_at);
        const repairWarrantyEnd = new Date(repairDate);
        repairWarrantyEnd.setDate(repairWarrantyEnd.getDate() + 30);

        repairs.push({
          id: repair.id,
          problem: repair.problem,
          final_cost: repair.final_cost,
          updated_at: repair.updated_at,
          repair_warranty_end: repairWarrantyEnd.toISOString(),
          repair_under_warranty: new Date() < repairWarrantyEnd,
        });
      }
    }

    return NextResponse.json({
      product,
      warranty: {
        warranty_months: warrantyMonths,
        purchase_date: purchaseDate,
        warranty_end_date: warrantyEndDate,
        is_under_warranty: isUnderWarranty,
      },
      sale: saleInfo,
      repairs,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
