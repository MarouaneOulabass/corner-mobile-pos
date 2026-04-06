import { NextResponse } from 'next/server';
import {
  buildRepairReadyMessage,
  buildReceiptMessage,
  buildPaymentReminderMessage,
  buildWarrantyExpiryMessage,
} from '@/lib/whatsapp';

// Dummy sale for sample receipt
const sampleSale = {
  id: 'abc12345-0000-0000-0000-000000000000',
  store_id: '',
  seller_id: '',
  total: 3200,
  discount_amount: 0,
  payment_method: 'cash' as const,
  created_at: new Date().toISOString(),
  items: [
    {
      id: '',
      sale_id: '',
      product_id: '',
      quantity: 1,
      unit_price: 3200,
      original_price: 3500,
      product: {
        id: '',
        product_type: 'phone' as const,
        brand: 'Apple',
        model: 'iPhone 13',
        storage: '128GB',
        condition: 'good' as const,
        purchase_price: 2500,
        selling_price: 3200,
        status: 'sold' as const,
        store_id: '',
        created_by: '',
        created_at: '',
        updated_at: '',
      },
    },
  ],
};

export async function GET() {
  const templates = [
    {
      name: 'repair_ready',
      description: 'Notification client — reparation prete a recuperer',
      required_data: ['customer_name', 'device', 'store_name'],
      sample: buildRepairReadyMessage('Ahmed', 'iPhone 13', 'M1 - Ait Baha'),
    },
    {
      name: 'receipt',
      description: 'Recu de vente partage via WhatsApp',
      required_data: ['sale (objet Sale complet)', 'store_name'],
      sample: buildReceiptMessage(sampleSale, 'M1 - Ait Baha'),
    },
    {
      name: 'payment_reminder',
      description: 'Rappel de paiement echeance (installment)',
      required_data: ['customer_name', 'amount', 'due_date'],
      sample: buildPaymentReminderMessage('Youssef', 800, '2026-04-15'),
    },
    {
      name: 'warranty_expiry',
      description: 'Notification expiration de garantie',
      required_data: ['customer_name', 'device', 'expiry_date'],
      sample: buildWarrantyExpiryMessage('Fatima', 'Samsung Galaxy A54', '2026-04-20'),
    },
  ];

  return NextResponse.json({ templates });
}
