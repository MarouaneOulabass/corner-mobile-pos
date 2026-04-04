import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    const store_id = searchParams.get('store_id');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');
    const seller_id = searchParams.get('seller_id');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const userStore = request.headers.get('x-user-store');
    const userRole = request.headers.get('x-user-role');

    let query = supabase
      .from('sales')
      .select(
        '*, seller:users(*), customer:customers(*), items:sale_items(*, product:products(*))',
        { count: 'exact' }
      );

    if (userRole !== 'superadmin' && userStore) {
      query = query.eq('store_id', userStore);
    } else if (store_id) {
      query = query.eq('store_id', store_id);
    }

    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to + 'T23:59:59');
    if (seller_id) query = query.eq('seller_id', seller_id);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ sales: data || [], total: count || 0 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

interface SaleItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
  original_price: number;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const sellerId = request.headers.get('x-user-id');
    const storeId = request.headers.get('x-user-store');

    if (!sellerId || !storeId) {
      return NextResponse.json({ error: 'Utilisateur non authentifié' }, { status: 401 });
    }

    // --- VALIDATION ---
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Le panier est vide' }, { status: 400 });
    }

    const validMethods = ['cash', 'card', 'virement', 'mixte'];
    if (!body.payment_method || !validMethods.includes(body.payment_method)) {
      return NextResponse.json({ error: 'Méthode de paiement invalide' }, { status: 400 });
    }

    // Validate each item
    for (const item of body.items as SaleItemInput[]) {
      if (!item.product_id) {
        return NextResponse.json({ error: 'product_id requis pour chaque article' }, { status: 400 });
      }
      if (!item.quantity || item.quantity < 1 || !Number.isInteger(item.quantity)) {
        return NextResponse.json({ error: 'Quantité invalide (doit être >= 1)' }, { status: 400 });
      }
      if (item.unit_price == null || item.unit_price < 0) {
        return NextResponse.json({ error: 'Prix unitaire invalide' }, { status: 400 });
      }
    }

    // Validate discount
    let discountAmount = 0;
    if (body.discount_amount && body.discount_amount > 0) {
      if (body.discount_type === 'percentage') {
        if (body.discount_amount > 100) {
          return NextResponse.json({ error: 'Remise en pourcentage ne peut pas dépasser 100%' }, { status: 400 });
        }
      }
    }

    // --- VERIFY ALL PRODUCTS EXIST, ARE IN_STOCK, AND BELONG TO THIS STORE ---
    const productIds = (body.items as SaleItemInput[]).map(i => i.product_id);
    const uniqueProductIds = Array.from(new Set(productIds));

    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, status, store_id, selling_price, purchase_price, product_type')
      .in('id', uniqueProductIds);

    if (prodError || !products) {
      return NextResponse.json({ error: 'Erreur vérification produits' }, { status: 500 });
    }

    const productMap = new Map(products.map(p => [p.id, p]));

    for (const item of body.items as SaleItemInput[]) {
      const product = productMap.get(item.product_id);
      if (!product) {
        return NextResponse.json({ error: `Produit ${item.product_id} introuvable` }, { status: 404 });
      }
      if (product.status !== 'in_stock') {
        return NextResponse.json({ error: `Le produit "${item.product_id}" n'est plus en stock (statut: ${product.status})` }, { status: 409 });
      }
      if (product.store_id !== storeId) {
        return NextResponse.json({ error: `Le produit n'appartient pas à votre magasin` }, { status: 403 });
      }
      // Phones must have quantity = 1
      if (product.product_type === 'phone' && item.quantity !== 1) {
        return NextResponse.json({ error: 'Un téléphone ne peut être vendu qu\'en quantité 1' }, { status: 400 });
      }
    }

    // --- CALCULATE TOTAL SERVER-SIDE ---
    // Use server prices as original_price, allow client unit_price (negotiation)
    const subtotal = (body.items as SaleItemInput[]).reduce(
      (sum, item) => sum + item.quantity * item.unit_price, 0
    );

    if (body.discount_amount && body.discount_amount > 0) {
      if (body.discount_type === 'percentage') {
        discountAmount = Math.round((subtotal * body.discount_amount) / 100 * 100) / 100;
      } else {
        discountAmount = body.discount_amount;
      }
    }

    if (discountAmount > subtotal) {
      return NextResponse.json({ error: 'La remise ne peut pas dépasser le sous-total' }, { status: 400 });
    }

    const total = Math.round((subtotal - discountAmount) * 100) / 100;

    // Validate mixte payment
    if (body.payment_method === 'mixte' && body.payment_details) {
      const detailsTotal = Object.values(body.payment_details as Record<string, number>)
        .reduce((s: number, v) => s + (Number(v) || 0), 0);
      if (Math.abs(detailsTotal - total) > 1) {
        return NextResponse.json({ error: `Le détail du paiement mixte (${detailsTotal}) ne correspond pas au total (${total})` }, { status: 400 });
      }
    }

    // --- HANDLE CUSTOMER ---
    let customerId = body.customer_id || null;
    if (!customerId && body.customer_phone) {
      const { data: existing } = await supabase
        .from('customers').select('id').eq('phone', body.customer_phone).maybeSingle();

      if (existing) {
        customerId = existing.id;
      } else {
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert({ name: body.customer_name || 'Client', phone: body.customer_phone, whatsapp: body.customer_phone })
          .select('id').single();
        if (custErr) return NextResponse.json({ error: 'Erreur création client: ' + custErr.message }, { status: 500 });
        customerId = newCust.id;
      }
    }

    // --- ATOMIC: Mark products as sold FIRST (with status check in WHERE) ---
    // This prevents double-sale: only products still in_stock will be updated
    const { data: updatedProducts, error: lockError } = await supabase
      .from('products')
      .update({ status: 'sold', updated_at: new Date().toISOString() })
      .in('id', uniqueProductIds)
      .eq('status', 'in_stock')
      .select('id');

    if (lockError) {
      return NextResponse.json({ error: 'Erreur lors du verrouillage des produits' }, { status: 500 });
    }

    // Check all products were successfully locked
    if (!updatedProducts || updatedProducts.length !== uniqueProductIds.length) {
      // Rollback: restore any products that were locked
      if (updatedProducts && updatedProducts.length > 0) {
        const lockedIds = updatedProducts.map(p => p.id);
        await supabase.from('products').update({ status: 'in_stock' }).in('id', lockedIds);
      }
      return NextResponse.json(
        { error: 'Un ou plusieurs produits ne sont plus disponibles. Un autre vendeur les a peut-être déjà vendus.' },
        { status: 409 }
      );
    }

    // --- CREATE SALE RECORD ---
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        store_id: storeId,
        seller_id: sellerId,
        customer_id: customerId,
        total,
        discount_amount: discountAmount,
        discount_type: body.discount_type || null,
        payment_method: body.payment_method,
        payment_details: body.payment_details || null,
      })
      .select('*').single();

    if (saleError) {
      // Rollback products
      await supabase.from('products').update({ status: 'in_stock' }).in('id', uniqueProductIds);
      return NextResponse.json({ error: 'Erreur création vente: ' + saleError.message }, { status: 500 });
    }

    // --- CREATE SALE ITEMS ---
    const saleItems = (body.items as SaleItemInput[]).map(item => {
      const product = productMap.get(item.product_id)!;
      return {
        sale_id: sale.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        original_price: product.selling_price, // Use SERVER price as original
      };
    });

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);

    if (itemsError) {
      // Rollback: delete sale + restore products
      await supabase.from('sales').delete().eq('id', sale.id);
      await supabase.from('products').update({ status: 'in_stock' }).in('id', uniqueProductIds);
      return NextResponse.json({ error: 'Erreur articles: ' + itemsError.message }, { status: 500 });
    }

    // --- FETCH COMPLETE SALE ---
    const { data: completeSale } = await supabase
      .from('sales')
      .select('*, seller:users(id,name), customer:customers(*), items:sale_items(*, product:products(*))')
      .eq('id', sale.id).single();

    return NextResponse.json(completeSale || sale, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
