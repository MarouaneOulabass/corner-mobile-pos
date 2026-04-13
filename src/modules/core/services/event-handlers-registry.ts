import { registerHandler } from './event-handlers';
import { createServiceClient } from './supabase';

/**
 * Initialize all event handlers.
 * Call this once at application startup (or before processing events).
 */
export function initializeEventHandlers(): void {
  // ─── sale.completed → notify store manager ───────────────────────
  registerHandler('sale.completed', async (event) => {
    const supabase = createServiceClient();
    const { store_id, total, seller_id, id: saleId } = event.payload as {
      store_id?: string;
      total?: number;
      seller_id?: string;
      id?: string;
    };

    if (!store_id) return;

    // Find the manager(s) of this store
    const { data: managers } = await supabase
      .from('users')
      .select('id, name')
      .eq('store_id', store_id)
      .in('role', ['manager', 'superadmin']);

    if (!managers || managers.length === 0) return;

    // Get seller name for the notification message
    let sellerName = 'Un vendeur';
    if (seller_id) {
      const { data: seller } = await supabase
        .from('users')
        .select('name')
        .eq('id', seller_id)
        .single();
      if (seller) sellerName = seller.name;
    }

    const formattedTotal = total != null ? `${Number(total).toLocaleString('fr-MA')} MAD` : 'N/A';

    // Create a notification for each manager
    const notifications = managers.map((manager) => ({
      user_id: manager.id,
      type: 'sale_made' as const,
      title: 'Nouvelle vente',
      message: `${sellerName} a réalisé une vente de ${formattedTotal}`,
      read: false,
      data: { sale_id: saleId, store_id, total, seller_id },
    }));

    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) {
      throw new Error(`Failed to create sale notification: ${error.message}`);
    }
  });

  // ─── product.low_stock → notify store manager ───────────────────
  registerHandler('product.low_stock', async (event) => {
    const supabase = createServiceClient();
    const {
      store_id,
      product_id,
      brand,
      model,
      current_quantity,
      threshold,
    } = event.payload as {
      store_id?: string;
      product_id?: string;
      brand?: string;
      model?: string;
      current_quantity?: number;
      threshold?: number;
    };

    if (!store_id) return;

    // Find manager(s) for the store
    const { data: managers } = await supabase
      .from('users')
      .select('id')
      .eq('store_id', store_id)
      .in('role', ['manager', 'superadmin']);

    if (!managers || managers.length === 0) return;

    const productLabel = [brand, model].filter(Boolean).join(' ') || 'Produit inconnu';
    const qtyInfo = current_quantity != null ? ` (${current_quantity} restant(s))` : '';
    const thresholdInfo = threshold != null ? ` — seuil: ${threshold}` : '';

    const notifications = managers.map((manager) => ({
      user_id: manager.id,
      type: 'low_stock' as const,
      title: 'Stock faible',
      message: `${productLabel}${qtyInfo}${thresholdInfo}`,
      read: false,
      data: { product_id, store_id, brand, model, current_quantity, threshold },
    }));

    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) {
      throw new Error(`Failed to create low_stock notification: ${error.message}`);
    }
  });
}
