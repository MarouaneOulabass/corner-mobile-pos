/**
 * Receipt builder — generates receipt content from a sale.
 * Supports both HTML (for browser/PDF printing) and ESC/POS (for thermal printers).
 */

import { Sale, Store, ReceiptTemplate } from '@/types';
import { formatPrice, formatDateTime, paymentMethodLabels } from '@/lib/utils';
import { ESCPOSBuilder } from './thermal-printer';

/**
 * Build an HTML receipt from a sale, template, and store.
 */
export function buildReceiptHTML(
  sale: Sale,
  template: ReceiptTemplate,
  store: Store,
  qrDataUrl?: string
): string {
  const paperWidth = template.paper_width === '58mm' ? '58mm' : '80mm';
  const fontSizeMap = { small: '10px', medium: '12px', large: '14px' };
  const fontSize = fontSizeMap[template.font_size] || '12px';

  const items = sale.items || [];
  const sellerName = sale.seller?.name || '';
  const paymentLabel = paymentMethodLabels[sale.payment_method] || sale.payment_method;

  // Calculate subtotal (before discount)
  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  let html = `
    <div style="
      width: ${paperWidth};
      max-width: ${paperWidth};
      font-family: 'Courier New', monospace;
      font-size: ${fontSize};
      color: #000;
      background: #fff;
      padding: 4mm;
      box-sizing: border-box;
    ">
  `;

  // Header
  if (template.header_text) {
    html += `
      <div style="text-align: center; font-weight: bold; font-size: ${fontSize === '10px' ? '12px' : '14px'}; margin-bottom: 4px;">
        ${escapeHtml(template.header_text)}
      </div>
    `;
  } else {
    html += `
      <div style="text-align: center; font-weight: bold; font-size: ${fontSize === '10px' ? '12px' : '14px'}; margin-bottom: 4px;">
        ${escapeHtml(store.name)}
      </div>
    `;
  }

  // Store address
  if (template.show_store_address && store.location) {
    html += `
      <div style="text-align: center; font-size: ${fontSize}; margin-bottom: 4px;">
        ${escapeHtml(store.location)}
      </div>
    `;
  }

  // Separator
  html += `<div style="border-top: 1px dashed #000; margin: 6px 0;"></div>`;

  // Receipt number + date
  html += `
    <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
      <span>N&deg; ${escapeHtml(sale.id.substring(0, 8).toUpperCase())}</span>
      <span>${formatDateTime(sale.created_at)}</span>
    </div>
  `;

  // Seller name
  if (template.show_seller_name && sellerName) {
    html += `
      <div style="margin-bottom: 4px;">
        Vendeur: ${escapeHtml(sellerName)}
      </div>
    `;
  }

  // Separator
  html += `<div style="border-top: 1px dashed #000; margin: 6px 0;"></div>`;

  // Items table
  html += `
    <table style="width: 100%; border-collapse: collapse; font-size: ${fontSize};">
      <thead>
        <tr>
          <th style="text-align: left; padding: 2px 0;">Article</th>
          <th style="text-align: center; padding: 2px 0;">Qté</th>
          <th style="text-align: right; padding: 2px 0;">P.U.</th>
          <th style="text-align: right; padding: 2px 0;">Total</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const item of items) {
    const productName = item.product
      ? `${item.product.brand} ${item.product.model}`
      : `Article`;
    const lineTotal = item.unit_price * item.quantity;

    html += `
      <tr>
        <td style="text-align: left; padding: 2px 0; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${escapeHtml(productName)}
        </td>
        <td style="text-align: center; padding: 2px 0;">${item.quantity}</td>
        <td style="text-align: right; padding: 2px 0;">${formatPrice(item.unit_price)}</td>
        <td style="text-align: right; padding: 2px 0;">${formatPrice(lineTotal)}</td>
      </tr>
    `;
  }

  html += `
      </tbody>
    </table>
  `;

  // Separator
  html += `<div style="border-top: 1px dashed #000; margin: 6px 0;"></div>`;

  // Subtotal
  if (sale.discount_amount > 0) {
    html += `
      <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
        <span>Sous-total</span>
        <span>${formatPrice(subtotal)}</span>
      </div>
    `;

    // Discount
    const discountLabel = sale.discount_type === 'percentage'
      ? `Remise`
      : `Remise`;
    html += `
      <div style="display: flex; justify-content: space-between; margin-bottom: 2px; color: #c00;">
        <span>${discountLabel}</span>
        <span>-${formatPrice(sale.discount_amount)}</span>
      </div>
    `;
  }

  // Total
  html += `
    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: ${fontSize === '10px' ? '13px' : '16px'}; margin: 4px 0;">
      <span>TOTAL</span>
      <span>${formatPrice(sale.total)}</span>
    </div>
  `;

  // Payment method
  html += `
    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
      <span>Paiement</span>
      <span>${escapeHtml(paymentLabel)}</span>
    </div>
  `;

  // Separator
  html += `<div style="border-top: 1px dashed #000; margin: 6px 0;"></div>`;

  // QR code
  if (template.show_qr_code && qrDataUrl) {
    html += `
      <div style="text-align: center; margin: 8px 0;">
        <img src="${qrDataUrl}" alt="QR" style="width: 80px; height: 80px;" />
      </div>
    `;
  }

  // Footer
  if (template.footer_text) {
    html += `
      <div style="text-align: center; font-size: ${fontSize}; margin-top: 4px;">
        ${escapeHtml(template.footer_text)}
      </div>
    `;
  }

  // Thank you message
  html += `
    <div style="text-align: center; margin-top: 8px; font-size: ${fontSize};">
      Merci de votre visite !
    </div>
  `;

  html += `</div>`;

  return html;
}

/**
 * Build ESC/POS binary data for a thermal printer receipt.
 */
export function buildReceiptESCPOS(sale: Sale, store: Store): Uint8Array {
  const builder = new ESCPOSBuilder();
  const items = sale.items || [];
  const sellerName = sale.seller?.name || '';
  const paymentLabel = paymentMethodLabels[sale.payment_method] || sale.payment_method;
  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  builder.init();

  // Store name
  builder.align('center');
  builder.fontSize(2);
  builder.bold(true);
  builder.text(store.name);
  builder.feed(1);
  builder.fontSize(1);
  builder.bold(false);

  // Store address
  if (store.location) {
    builder.text(store.location);
    builder.feed(1);
  }

  builder.separator('=', 32);

  // Receipt number + date
  builder.align('left');
  builder.text(`No ${sale.id.substring(0, 8).toUpperCase()}`);
  builder.feed(1);
  builder.text(formatDateTime(sale.created_at));
  builder.feed(1);

  // Seller
  if (sellerName) {
    builder.text(`Vendeur: ${sellerName}`);
    builder.feed(1);
  }

  builder.separator('-', 32);

  // Items
  for (const item of items) {
    const productName = item.product
      ? `${item.product.brand} ${item.product.model}`
      : 'Article';
    const lineTotal = item.unit_price * item.quantity;

    // Product name on first line
    builder.text(productName.substring(0, 32));
    builder.feed(1);

    // Qty x Price = Total on second line
    const qtyPrice = `  ${item.quantity} x ${formatPrice(item.unit_price)}`;
    const totalStr = formatPrice(lineTotal);
    const padding = Math.max(1, 32 - qtyPrice.length - totalStr.length);
    builder.text(qtyPrice + ' '.repeat(padding) + totalStr);
    builder.feed(1);
  }

  builder.separator('-', 32);

  // Subtotal + discount
  if (sale.discount_amount > 0) {
    const stLabel = 'Sous-total';
    const stVal = formatPrice(subtotal);
    const stPad = Math.max(1, 32 - stLabel.length - stVal.length);
    builder.text(stLabel + ' '.repeat(stPad) + stVal);
    builder.feed(1);

    const discLabel = 'Remise';
    const discVal = `-${formatPrice(sale.discount_amount)}`;
    const discPad = Math.max(1, 32 - discLabel.length - discVal.length);
    builder.text(discLabel + ' '.repeat(discPad) + discVal);
    builder.feed(1);
  }

  // Total
  builder.bold(true);
  builder.fontSize(2);
  const totalLabel = 'TOTAL';
  const totalVal = formatPrice(sale.total);
  const totalPad = Math.max(1, 32 - totalLabel.length - totalVal.length);
  builder.text(totalLabel + ' '.repeat(totalPad) + totalVal);
  builder.feed(1);
  builder.fontSize(1);
  builder.bold(false);

  // Payment method
  const pmLabel = 'Paiement';
  const pmPad = Math.max(1, 32 - pmLabel.length - paymentLabel.length);
  builder.text(pmLabel + ' '.repeat(pmPad) + paymentLabel);
  builder.feed(1);

  builder.separator('=', 32);

  // Thank you
  builder.align('center');
  builder.text('Merci de votre visite !');
  builder.feed(3);

  // Cut
  builder.cut();

  return builder.build();
}

/** Escape HTML entities */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
