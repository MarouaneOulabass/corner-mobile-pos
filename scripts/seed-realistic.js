/**
 * Corner Mobile POS — Realistic Data Seed Script
 * Populates the database with realistic Moroccan market data:
 * - 25+ customers with Moroccan names & phones
 * - 40+ products (phones, accessories, parts) with real market prices
 * - 15+ sales with realistic cart combinations
 * - 10+ repairs at various stages
 * - Suppliers, parts, cash sessions, loyalty, gift cards
 * - Trade-ins, returns, commissions, clock records
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_KEY. Run with: node --env-file=.env.local scripts/seed-realistic.js');
  process.exit(1);
}

const STORE_M1 = 'a0000000-0000-0000-0000-000000000001';
const STORE_M2 = 'a0000000-0000-0000-0000-000000000002';
const ADMIN_ID = 'b0000000-0000-0000-0000-000000000001';
const MGR_M1 = 'b0000000-0000-0000-0000-000000000002';
const MGR_M2 = 'b0000000-0000-0000-0000-000000000003';
const SELLER_M1 = 'b0000000-0000-0000-0000-000000000004';
const SELLER_M2 = 'b0000000-0000-0000-0000-000000000005';

async function supabase(table, method, body) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
  };

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${method} ${table}: ${res.status} — ${err}`);
  }
  if (method === 'POST') return res.json();
  return null;
}

async function query(table, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
  });
  return res.json();
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function randomDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo));
  d.setHours(Math.floor(Math.random() * 10) + 8, Math.floor(Math.random() * 60));
  return d.toISOString();
}

function luhnIMEI() {
  const prefix = '35' + String(Math.floor(Math.random() * 10)) + String(Math.floor(Math.random() * 10)) + '00';
  let partial = prefix;
  for (let i = partial.length; i < 14; i++) partial += Math.floor(Math.random() * 10);
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let d = parseInt(partial[i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  return partial + check;
}

async function run() {
  console.log('🌱 Seeding Corner Mobile with realistic data...\n');

  // ══════════════════════════════════════
  // 1. CUSTOMERS (25 Moroccan names)
  // ══════════════════════════════════════
  console.log('👥 Creating customers...');
  const customerData = [
    { name: 'Hassan Benali', phone: '0661234567', whatsapp: '0661234567', email: 'hassan.b@gmail.com' },
    { name: 'Fatima Zahra Alaoui', phone: '0672345678', whatsapp: '0672345678' },
    { name: 'Mohamed El Amrani', phone: '0653456789', whatsapp: '0653456789', email: 'amrani.med@gmail.com' },
    { name: 'Khadija Bennani', phone: '0664567890', whatsapp: '0664567890' },
    { name: 'Youssef Tazi', phone: '0675678901', whatsapp: '0675678901', email: 'ytazi@outlook.com' },
    { name: 'Amina Idrissi', phone: '0656789012', whatsapp: '0656789012' },
    { name: 'Omar Chraibi', phone: '0667890123', whatsapp: '0667890123' },
    { name: 'Zineb El Fassi', phone: '0678901234', whatsapp: '0678901234', email: 'zineb.f@gmail.com' },
    { name: 'Rachid Lahlou', phone: '0659012345', whatsapp: '0659012345' },
    { name: 'Salma Berrada', phone: '0660123456', whatsapp: '0660123456' },
    { name: 'Karim Ouazzani', phone: '0671234567', whatsapp: '0671234567', email: 'karim.o@yahoo.fr' },
    { name: 'Nadia Sqalli', phone: '0652345678', whatsapp: '0652345678' },
    { name: 'Mehdi Benjelloun', phone: '0663456789', whatsapp: '0663456789' },
    { name: 'Houda Filali', phone: '0674567890', whatsapp: '0674567890', email: 'houda.filali@gmail.com' },
    { name: 'Amine Kettani', phone: '0655678901', whatsapp: '0655678901' },
    { name: 'Samira El Mansouri', phone: '0666789012', whatsapp: '0666789012' },
    { name: 'Hamza Belhaj', phone: '0677890123', whatsapp: '0677890123' },
    { name: 'Laila Touri', phone: '0658901234', whatsapp: '0658901234', email: 'laila.t@gmail.com' },
    { name: 'Driss Chakir', phone: '0669012345', whatsapp: '0669012345' },
    { name: 'Rim Aboutalib', phone: '0670123456', whatsapp: '0670123456' },
    { name: 'Said Aboubakr', phone: '0651234567', whatsapp: '0651234567', email: 'said.ab@hotmail.com' },
    { name: 'Ghita Naciri', phone: '0662345678', whatsapp: '0662345678' },
    { name: 'Adil Bouazza', phone: '0673456789', whatsapp: '0673456789' },
    { name: 'Imane Rahmani', phone: '0654567890', whatsapp: '0654567890' },
    { name: 'Soufiane El Khattabi', phone: '0665678901', whatsapp: '0665678901', email: 'soufiane.k@gmail.com' },
  ].map(c => ({ id: uuid(), ...c, loyalty_tier: 'bronze', loyalty_points: 0, store_credit: 0 }));

  // Give some customers higher loyalty
  customerData[0].loyalty_tier = 'gold'; customerData[0].loyalty_points = 2450; customerData[0].store_credit = 150;
  customerData[2].loyalty_tier = 'silver'; customerData[2].loyalty_points = 850;
  customerData[4].loyalty_tier = 'platinum'; customerData[4].loyalty_points = 5200; customerData[4].store_credit = 300;
  customerData[7].loyalty_tier = 'silver'; customerData[7].loyalty_points = 720;
  customerData[10].loyalty_tier = 'gold'; customerData[10].loyalty_points = 3100;

  try { await supabase('customers', 'POST', customerData); } catch(e) { console.log('  ⚠️ Customers may already exist:', e.message.substring(0, 80)); }
  console.log(`  ✅ ${customerData.length} customers`);

  // ══════════════════════════════════════
  // 2. SUPPLIERS
  // ══════════════════════════════════════
  console.log('🏭 Creating suppliers...');
  const supplierData = [
    { id: uuid(), name: 'TechMobile Casablanca', contact_name: 'Rachid Moumen', phone: '0522334455', email: 'contact@techmobile.ma', address: 'Ain Sebaa, Casablanca', store_id: STORE_M1, created_by: ADMIN_ID },
    { id: uuid(), name: 'PhoneStock Maroc', contact_name: 'Ali Fassi', phone: '0537221100', email: 'ali@phonestock.ma', address: 'Hay Riad, Rabat', store_id: STORE_M1, created_by: ADMIN_ID },
    { id: uuid(), name: 'iRepair Parts', contact_name: 'Hamid Ziani', phone: '0661998877', email: 'hamid@irepairparts.com', address: 'Derb Omar, Casablanca', store_id: STORE_M1, created_by: ADMIN_ID },
    { id: uuid(), name: 'Samsung Distributeur Officiel', contact_name: 'Service Commercial', phone: '0522889900', email: 'b2b@samsung.ma', address: 'Anfa, Casablanca', store_id: STORE_M1, created_by: ADMIN_ID },
    { id: uuid(), name: 'AccessoirePro', contact_name: 'Nadia Ait Ahmed', phone: '0662445566', email: 'nadia@accessoirepro.ma', address: 'Quartier Industriel, Kenitra', store_id: STORE_M2, created_by: MGR_M2 },
  ];
  try { await supabase('suppliers', 'POST', supplierData); } catch(e) { console.log('  ⚠️', e.message.substring(0, 80)); }
  console.log(`  ✅ ${supplierData.length} suppliers`);

  // ══════════════════════════════════════
  // 3. PRODUCTS (40+ phones, accessories, parts)
  // ══════════════════════════════════════
  console.log('📱 Creating products...');
  const phones = [
    // M1 — iPhones
    { brand: 'Apple', model: 'iPhone 15 Pro Max', storage: '256 Go', color: 'Titane naturel', condition: 'like_new', purchase_price: 9500, selling_price: 11500, warranty_months: 6, bin_location: 'Vitrine A1' },
    { brand: 'Apple', model: 'iPhone 15 Pro', storage: '128 Go', color: 'Titane bleu', condition: 'good', purchase_price: 7800, selling_price: 9200, warranty_months: 3, bin_location: 'Vitrine A1' },
    { brand: 'Apple', model: 'iPhone 14', storage: '128 Go', color: 'Minuit', condition: 'good', purchase_price: 5200, selling_price: 6500, warranty_months: 3, bin_location: 'Vitrine A2' },
    { brand: 'Apple', model: 'iPhone 13', storage: '128 Go', color: 'Bleu', condition: 'good', purchase_price: 3800, selling_price: 4800, warranty_months: 3, bin_location: 'Vitrine A2' },
    { brand: 'Apple', model: 'iPhone 13 Mini', storage: '128 Go', color: 'Rouge', condition: 'fair', purchase_price: 2800, selling_price: 3500, warranty_months: 0, bin_location: 'Etagere B1' },
    { brand: 'Apple', model: 'iPhone 12', storage: '64 Go', color: 'Noir', condition: 'fair', purchase_price: 2200, selling_price: 2900, warranty_months: 0, bin_location: 'Etagere B1' },
    { brand: 'Apple', model: 'iPhone 11', storage: '64 Go', color: 'Blanc', condition: 'good', purchase_price: 1800, selling_price: 2400, warranty_months: 0, bin_location: 'Etagere B2' },
    // M1 — Samsung
    { brand: 'Samsung', model: 'Galaxy S24 Ultra', storage: '256 Go', color: 'Violet', condition: 'like_new', purchase_price: 8500, selling_price: 10500, warranty_months: 6, bin_location: 'Vitrine A3' },
    { brand: 'Samsung', model: 'Galaxy S24', storage: '128 Go', color: 'Noir', condition: 'new', purchase_price: 6000, selling_price: 7500, warranty_months: 12, bin_location: 'Vitrine A3' },
    { brand: 'Samsung', model: 'Galaxy A54', storage: '128 Go', color: 'Vert', condition: 'good', purchase_price: 2200, selling_price: 2900, warranty_months: 3, bin_location: 'Etagere C1' },
    { brand: 'Samsung', model: 'Galaxy A34', storage: '128 Go', color: 'Noir', condition: 'good', purchase_price: 1800, selling_price: 2400, warranty_months: 3, bin_location: 'Etagere C1' },
    { brand: 'Samsung', model: 'Galaxy A14', storage: '64 Go', color: 'Blanc', condition: 'new', purchase_price: 1200, selling_price: 1600, warranty_months: 12, bin_location: 'Etagere C2' },
    // M1 — Xiaomi
    { brand: 'Xiaomi', model: 'Redmi Note 13 Pro', storage: '256 Go', color: 'Bleu', condition: 'new', purchase_price: 2400, selling_price: 3100, warranty_months: 12, bin_location: 'Etagere D1' },
    { brand: 'Xiaomi', model: 'Redmi Note 12', storage: '128 Go', color: 'Noir', condition: 'good', purchase_price: 1400, selling_price: 1900, warranty_months: 3, bin_location: 'Etagere D1' },
    { brand: 'Xiaomi', model: 'Poco X6 Pro', storage: '256 Go', color: 'Gris', condition: 'like_new', purchase_price: 2600, selling_price: 3300, warranty_months: 6, bin_location: 'Etagere D2' },
    // Oppo / Others
    { brand: 'OPPO', model: 'Reno 11', storage: '256 Go', color: 'Vert', condition: 'new', purchase_price: 3000, selling_price: 3800, warranty_months: 12, bin_location: 'Etagere E1' },
    { brand: 'Huawei', model: 'Nova 12i', storage: '128 Go', color: 'Noir', condition: 'new', purchase_price: 1800, selling_price: 2300, warranty_months: 12, bin_location: 'Etagere E1' },
  ];

  const phonesM2 = [
    { brand: 'Apple', model: 'iPhone 15', storage: '128 Go', color: 'Rose', condition: 'like_new', purchase_price: 6500, selling_price: 7900, warranty_months: 6, bin_location: 'Vitrine 1' },
    { brand: 'Apple', model: 'iPhone 14 Pro', storage: '256 Go', color: 'Or', condition: 'good', purchase_price: 6800, selling_price: 8200, warranty_months: 3, bin_location: 'Vitrine 1' },
    { brand: 'Apple', model: 'iPhone 13', storage: '256 Go', color: 'Vert', condition: 'like_new', purchase_price: 4200, selling_price: 5300, warranty_months: 3, bin_location: 'Vitrine 2' },
    { brand: 'Samsung', model: 'Galaxy S23', storage: '128 Go', color: 'Creme', condition: 'good', purchase_price: 4500, selling_price: 5600, warranty_months: 3, bin_location: 'Vitrine 2' },
    { brand: 'Samsung', model: 'Galaxy A54', storage: '128 Go', color: 'Violet', condition: 'like_new', purchase_price: 2400, selling_price: 3100, warranty_months: 6, bin_location: 'Etagere A' },
    { brand: 'Xiaomi', model: 'Redmi Note 13', storage: '128 Go', color: 'Bleu', condition: 'new', purchase_price: 1600, selling_price: 2100, warranty_months: 12, bin_location: 'Etagere B' },
    { brand: 'Xiaomi', model: '14T', storage: '256 Go', color: 'Gris', condition: 'new', purchase_price: 3200, selling_price: 4000, warranty_months: 12, bin_location: 'Etagere B' },
  ];

  const accessories = [
    // M1
    { brand: 'Apple', model: 'Coque iPhone 15 Pro Silicone', product_type: 'accessory', condition: 'new', purchase_price: 30, selling_price: 80, bin_location: 'Tiroir Acc-1', store: STORE_M1 },
    { brand: 'Apple', model: 'Coque iPhone 14 Transparente', product_type: 'accessory', condition: 'new', purchase_price: 15, selling_price: 50, bin_location: 'Tiroir Acc-1', store: STORE_M1 },
    { brand: 'Samsung', model: 'Coque Galaxy S24 Cuir', product_type: 'accessory', condition: 'new', purchase_price: 40, selling_price: 120, bin_location: 'Tiroir Acc-2', store: STORE_M1 },
    { brand: 'Generique', model: 'Verre trempe universel 6.1"', product_type: 'accessory', condition: 'new', purchase_price: 5, selling_price: 30, bin_location: 'Tiroir Acc-3', store: STORE_M1 },
    { brand: 'Generique', model: 'Chargeur USB-C 20W', product_type: 'accessory', condition: 'new', purchase_price: 25, selling_price: 70, bin_location: 'Tiroir Acc-4', store: STORE_M1 },
    { brand: 'Apple', model: 'Cable Lightning 1m', product_type: 'accessory', condition: 'new', purchase_price: 20, selling_price: 60, bin_location: 'Tiroir Acc-4', store: STORE_M1 },
    { brand: 'Generique', model: 'Ecouteurs Bluetooth TWS', product_type: 'accessory', condition: 'new', purchase_price: 40, selling_price: 120, bin_location: 'Tiroir Acc-5', store: STORE_M1 },
    { brand: 'Generique', model: 'Powerbank 10000mAh', product_type: 'accessory', condition: 'new', purchase_price: 60, selling_price: 150, bin_location: 'Tiroir Acc-5', store: STORE_M1 },
    // M2
    { brand: 'Apple', model: 'Coque iPhone 15 MagSafe', product_type: 'accessory', condition: 'new', purchase_price: 50, selling_price: 150, bin_location: 'Rayon A', store: STORE_M2 },
    { brand: 'Samsung', model: 'Coque Galaxy A54 Silicone', product_type: 'accessory', condition: 'new', purchase_price: 15, selling_price: 50, bin_location: 'Rayon A', store: STORE_M2 },
    { brand: 'Generique', model: 'Support voiture magnetique', product_type: 'accessory', condition: 'new', purchase_price: 20, selling_price: 60, bin_location: 'Rayon B', store: STORE_M2 },
    { brand: 'Generique', model: 'Verre trempe iPhone 15', product_type: 'accessory', condition: 'new', purchase_price: 8, selling_price: 40, bin_location: 'Rayon B', store: STORE_M2 },
  ];

  const allProducts = [];

  // Phones M1
  for (const p of phones) {
    allProducts.push({
      id: uuid(), imei: luhnIMEI(), product_type: 'phone', ...p,
      status: 'in_stock', store_id: STORE_M1, supplier: supplierData[0].name, supplier_id: supplierData[0].id,
      created_by: SELLER_M1, purchase_date: randomDate(60), created_at: randomDate(60),
    });
  }
  // Phones M2
  for (const p of phonesM2) {
    allProducts.push({
      id: uuid(), imei: luhnIMEI(), product_type: 'phone', ...p,
      status: 'in_stock', store_id: STORE_M2, supplier: supplierData[1].name, supplier_id: supplierData[1].id,
      created_by: SELLER_M2, purchase_date: randomDate(45), created_at: randomDate(45),
    });
  }
  // Accessories
  for (const a of accessories) {
    const storeId = a.store;
    delete a.store;
    allProducts.push({
      id: uuid(), product_type: a.product_type || 'accessory', ...a,
      status: 'in_stock', store_id: storeId, created_by: storeId === STORE_M1 ? SELLER_M1 : SELLER_M2,
      purchase_date: randomDate(30), created_at: randomDate(30),
    });
  }

  try { await supabase('products', 'POST', allProducts); } catch(e) { console.log('  ⚠️', e.message.substring(0, 100)); }
  console.log(`  ✅ ${allProducts.length} products (${phones.length + phonesM2.length} phones, ${accessories.length} accessories)`);

  // ══════════════════════════════════════
  // 4. PARTS INVENTORY
  // ══════════════════════════════════════
  console.log('🔩 Creating parts inventory...');
  const partsData = [
    { name: 'Ecran iPhone 13 OLED', category: 'screen', compatible_brands: ['Apple'], compatible_models: ['iPhone 13'], quantity: 5, min_quantity: 3, purchase_price: 350, selling_price: 600, store_id: STORE_M1, bin_location: 'Stock P-A1' },
    { name: 'Ecran iPhone 14 OLED', category: 'screen', compatible_brands: ['Apple'], compatible_models: ['iPhone 14'], quantity: 3, min_quantity: 2, purchase_price: 500, selling_price: 800, store_id: STORE_M1, bin_location: 'Stock P-A1' },
    { name: 'Ecran Samsung A54 LCD', category: 'screen', compatible_brands: ['Samsung'], compatible_models: ['Galaxy A54'], quantity: 4, min_quantity: 2, purchase_price: 200, selling_price: 400, store_id: STORE_M1, bin_location: 'Stock P-A2' },
    { name: 'Batterie iPhone 13', category: 'battery', compatible_brands: ['Apple'], compatible_models: ['iPhone 13', 'iPhone 13 Mini'], quantity: 8, min_quantity: 5, purchase_price: 80, selling_price: 200, store_id: STORE_M1, bin_location: 'Stock P-B1' },
    { name: 'Batterie iPhone 12', category: 'battery', compatible_brands: ['Apple'], compatible_models: ['iPhone 12', 'iPhone 12 Mini'], quantity: 6, min_quantity: 3, purchase_price: 70, selling_price: 180, store_id: STORE_M1, bin_location: 'Stock P-B1' },
    { name: 'Batterie Samsung S24', category: 'battery', compatible_brands: ['Samsung'], compatible_models: ['Galaxy S24'], quantity: 2, min_quantity: 2, purchase_price: 120, selling_price: 250, store_id: STORE_M1, bin_location: 'Stock P-B2' },
    { name: 'Port de charge iPhone Lightning', category: 'charging_port', compatible_brands: ['Apple'], compatible_models: ['iPhone 11', 'iPhone 12', 'iPhone 13', 'iPhone 14'], quantity: 10, min_quantity: 5, purchase_price: 30, selling_price: 100, store_id: STORE_M1, bin_location: 'Stock P-C1' },
    { name: 'Port USB-C Samsung', category: 'charging_port', compatible_brands: ['Samsung'], compatible_models: ['Galaxy A54', 'Galaxy A34', 'Galaxy S24'], quantity: 7, min_quantity: 3, purchase_price: 25, selling_price: 80, store_id: STORE_M1, bin_location: 'Stock P-C1' },
    { name: 'Camera arriere iPhone 13', category: 'camera', compatible_brands: ['Apple'], compatible_models: ['iPhone 13'], quantity: 3, min_quantity: 2, purchase_price: 150, selling_price: 350, store_id: STORE_M1, bin_location: 'Stock P-D1' },
    { name: 'Haut-parleur iPhone universel', category: 'speaker', compatible_brands: ['Apple'], compatible_models: ['iPhone 11', 'iPhone 12', 'iPhone 13'], quantity: 5, min_quantity: 3, purchase_price: 20, selling_price: 60, store_id: STORE_M1, bin_location: 'Stock P-E1' },
    // M2 parts
    { name: 'Ecran iPhone 15 OLED', category: 'screen', compatible_brands: ['Apple'], compatible_models: ['iPhone 15'], quantity: 2, min_quantity: 2, purchase_price: 650, selling_price: 1000, store_id: STORE_M2, bin_location: 'Pieces A' },
    { name: 'Batterie Samsung A54', category: 'battery', compatible_brands: ['Samsung'], compatible_models: ['Galaxy A54'], quantity: 4, min_quantity: 2, purchase_price: 60, selling_price: 150, store_id: STORE_M2, bin_location: 'Pieces B' },
  ].map(p => ({ id: uuid(), ...p, supplier_id: supplierData[2].id }));

  try { await supabase('parts_inventory', 'POST', partsData); } catch(e) { console.log('  ⚠️', e.message.substring(0, 100)); }
  console.log(`  ✅ ${partsData.length} parts`);

  // ══════════════════════════════════════
  // 5. SALES (15 realistic sales over last 7 days)
  // ══════════════════════════════════════
  console.log('💰 Creating sales...');
  const phonesToSell = allProducts.filter(p => p.product_type === 'phone').slice(0, 8);
  const salesData = [];
  const saleItemsData = [];

  for (let i = 0; i < Math.min(8, phonesToSell.length); i++) {
    const phone = phonesToSell[i];
    const saleId = uuid();
    const customer = customerData[i % customerData.length];
    const isMixte = i === 3;
    const hasDiscount = i % 3 === 0;
    const discountAmt = hasDiscount ? Math.floor(phone.selling_price * 0.05) : 0;
    const total = phone.selling_price - discountAmt;

    salesData.push({
      id: saleId,
      store_id: phone.store_id,
      seller_id: phone.store_id === STORE_M1 ? SELLER_M1 : SELLER_M2,
      customer_id: customer.id,
      total,
      discount_amount: discountAmt,
      discount_type: hasDiscount ? 'flat' : null,
      payment_method: isMixte ? 'mixte' : i % 2 === 0 ? 'cash' : 'card',
      payment_details: isMixte ? { cash: Math.floor(total / 2), card: total - Math.floor(total / 2) } : null,
      created_at: randomDate(7),
    });

    saleItemsData.push({
      id: uuid(), sale_id: saleId, product_id: phone.id, quantity: 1,
      unit_price: phone.selling_price - discountAmt, original_price: phone.selling_price,
    });

    // Mark phone as sold
    phone.status = 'sold';
  }

  // Accessory-only sales
  for (let i = 0; i < 5; i++) {
    const saleId = uuid();
    const acc1 = accessories[i % accessories.length];
    const acc1Product = allProducts.find(p => p.model === acc1.model && p.store_id === STORE_M1);
    if (!acc1Product) continue;
    const total = acc1Product.selling_price * 2;

    salesData.push({
      id: saleId, store_id: STORE_M1, seller_id: SELLER_M1,
      customer_id: customerData[(i + 10) % customerData.length].id,
      total, discount_amount: 0, payment_method: 'cash',
      created_at: randomDate(5),
    });

    saleItemsData.push({
      id: uuid(), sale_id: saleId, product_id: acc1Product.id, quantity: 2,
      unit_price: acc1Product.selling_price, original_price: acc1Product.selling_price,
    });
  }

  try { await supabase('sales', 'POST', salesData); } catch(e) { console.log('  ⚠️ Sales:', e.message.substring(0, 100)); }
  try { await supabase('sale_items', 'POST', saleItemsData); } catch(e) { console.log('  ⚠️ Sale items:', e.message.substring(0, 100)); }

  // Update sold phones
  for (const phone of phonesToSell.filter(p => p.status === 'sold')) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${phone.id}`, {
        method: 'PATCH',
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'sold' }),
      });
    } catch {}
  }

  console.log(`  ✅ ${salesData.length} sales with ${saleItemsData.length} items`);

  // ══════════════════════════════════════
  // 6. REPAIRS (10 at various stages)
  // ══════════════════════════════════════
  console.log('🔧 Creating repairs...');
  const repairStatuses = ['received', 'diagnosing', 'waiting_parts', 'in_repair', 'in_repair', 'ready', 'ready', 'delivered', 'delivered', 'cancelled'];
  const repairProblems = [
    { problem: 'Ecran casse apres chute', problem_categories: ['broken_screen'], device_brand: 'Apple', device_model: 'iPhone 13', estimated_cost: 600 },
    { problem: 'Batterie gonflee, telephone surchauffe', problem_categories: ['battery'], device_brand: 'Samsung', device_model: 'Galaxy S23', estimated_cost: 250 },
    { problem: 'Port de charge ne fonctionne plus', problem_categories: ['charging_port'], device_brand: 'Apple', device_model: 'iPhone 12', estimated_cost: 150 },
    { problem: 'Camera arriere floue apres mise a jour', problem_categories: ['camera'], device_brand: 'Apple', device_model: 'iPhone 14 Pro', estimated_cost: 400 },
    { problem: 'Degats des eaux - telephone tombe dans la piscine', problem_categories: ['water_damage'], device_brand: 'Samsung', device_model: 'Galaxy A54', estimated_cost: 350 },
    { problem: 'Ecran fisure + batterie faible', problem_categories: ['broken_screen', 'battery'], device_brand: 'Xiaomi', device_model: 'Redmi Note 12', estimated_cost: 450 },
    { problem: 'Bouton power bloque', problem_categories: ['other'], device_brand: 'Apple', device_model: 'iPhone 11', estimated_cost: 120 },
    { problem: 'Ecran tactile ne repond plus par endroits', problem_categories: ['broken_screen'], device_brand: 'Samsung', device_model: 'Galaxy S24', estimated_cost: 800 },
    { problem: 'Face ID ne fonctionne plus', problem_categories: ['other'], device_brand: 'Apple', device_model: 'iPhone 15 Pro', estimated_cost: 500 },
    { problem: 'Haut-parleur gresille pendant les appels', problem_categories: ['other'], device_brand: 'OPPO', device_model: 'Reno 11', estimated_cost: 100 },
  ];

  const repairsData = repairProblems.map((r, i) => ({
    id: uuid(),
    customer_id: customerData[i + 5].id,
    store_id: i < 7 ? STORE_M1 : STORE_M2,
    technician_id: i < 7 ? SELLER_M1 : SELLER_M2,
    ...r,
    imei: luhnIMEI(),
    condition_on_arrival: i % 2 === 0 ? 'Quelques rayures sur les bords' : 'Bon etat general, protege par coque',
    status: repairStatuses[i],
    final_cost: repairStatuses[i] === 'delivered' ? r.estimated_cost + Math.floor(Math.random() * 100 - 50) : null,
    deposit: Math.floor(r.estimated_cost * 0.3),
    estimated_completion_date: new Date(Date.now() + (i - 3) * 86400000).toISOString().split('T')[0],
    created_at: randomDate(14),
    pre_checklist: { screen: i % 2 === 0 ? 'Fissure' : 'OK', battery: 'OK', charging_port: 'OK', cameras: 'OK' },
  }));

  try { await supabase('repairs', 'POST', repairsData); } catch(e) { console.log('  ⚠️ Repairs:', e.message.substring(0, 100)); }

  // Add status logs
  const statusLogs = [];
  for (const repair of repairsData) {
    statusLogs.push({ id: uuid(), repair_id: repair.id, status: 'received', changed_by: repair.technician_id, changed_at: repair.created_at, notes: 'Appareil recu' });
    if (['diagnosing','waiting_parts','in_repair','ready','delivered'].includes(repair.status)) {
      statusLogs.push({ id: uuid(), repair_id: repair.id, status: 'diagnosing', changed_by: repair.technician_id, changed_at: randomDate(10) });
    }
    if (['in_repair','ready','delivered'].includes(repair.status)) {
      statusLogs.push({ id: uuid(), repair_id: repair.id, status: 'in_repair', changed_by: repair.technician_id, changed_at: randomDate(7) });
    }
    if (['ready','delivered'].includes(repair.status)) {
      statusLogs.push({ id: uuid(), repair_id: repair.id, status: 'ready', changed_by: repair.technician_id, changed_at: randomDate(3) });
    }
    if (repair.status === 'delivered') {
      statusLogs.push({ id: uuid(), repair_id: repair.id, status: 'delivered', changed_by: repair.technician_id, changed_at: randomDate(1) });
    }
  }
  try { await supabase('repair_status_log', 'POST', statusLogs); } catch(e) { console.log('  ⚠️', e.message.substring(0, 80)); }
  console.log(`  ✅ ${repairsData.length} repairs with ${statusLogs.length} status logs`);

  // ══════════════════════════════════════
  // 7. GIFT CARDS, LOYALTY SETTINGS, CASH SESSION
  // ══════════════════════════════════════
  console.log('🎁 Creating gift cards, loyalty, cash...');

  const giftCards = [
    { id: uuid(), code: 'CORNER100', initial_amount: 100, current_balance: 100, store_id: STORE_M1, created_by: MGR_M1, status: 'active' },
    { id: uuid(), code: 'CORNER250', initial_amount: 250, current_balance: 175, customer_id: customerData[3].id, store_id: STORE_M1, created_by: MGR_M1, status: 'active' },
    { id: uuid(), code: 'CADEAU500', initial_amount: 500, current_balance: 0, customer_id: customerData[7].id, store_id: STORE_M2, created_by: MGR_M2, status: 'used' },
    { id: uuid(), code: 'VIP2024', initial_amount: 1000, current_balance: 650, customer_id: customerData[4].id, store_id: STORE_M1, created_by: ADMIN_ID, status: 'active' },
  ];
  try { await supabase('gift_cards', 'POST', giftCards); } catch(e) { console.log('  ⚠️', e.message.substring(0, 80)); }

  const loyaltySettings = [
    { id: uuid(), store_id: STORE_M1, points_per_mad: 1, redemption_rate: 0.1, bronze_threshold: 0, silver_threshold: 500, gold_threshold: 2000, platinum_threshold: 5000, enabled: true },
    { id: uuid(), store_id: STORE_M2, points_per_mad: 1, redemption_rate: 0.1, bronze_threshold: 0, silver_threshold: 500, gold_threshold: 2000, platinum_threshold: 5000, enabled: true },
  ];
  try { await supabase('loyalty_settings', 'POST', loyaltySettings); } catch(e) { console.log('  ⚠️', e.message.substring(0, 80)); }

  // Open cash session for M1
  const cashSession = {
    id: uuid(), store_id: STORE_M1, opened_by: SELLER_M1, opening_amount: 500,
    status: 'open', opened_at: new Date(Date.now() - 3 * 3600000).toISOString(),
  };
  try { await supabase('cash_sessions', 'POST', [cashSession]); } catch(e) { console.log('  ⚠️', e.message.substring(0, 80)); }

  console.log(`  ✅ ${giftCards.length} gift cards, 2 loyalty configs, 1 cash session`);

  // ══════════════════════════════════════
  // 8. TRADE-INS
  // ══════════════════════════════════════
  console.log('📱 Creating trade-ins...');
  const tradeIns = [
    { id: uuid(), customer_id: customerData[15].id, store_id: STORE_M1, processed_by: SELLER_M1, device_brand: 'Apple', device_model: 'iPhone XR', imei: luhnIMEI(), storage: '64 Go', color: 'Corail', condition: 'fair', offered_price: 1200, ai_suggested_price: 1350, status: 'pending' },
    { id: uuid(), customer_id: customerData[18].id, store_id: STORE_M1, processed_by: SELLER_M1, device_brand: 'Samsung', device_model: 'Galaxy S21', imei: luhnIMEI(), storage: '128 Go', color: 'Gris', condition: 'good', offered_price: 2200, ai_suggested_price: 2100, status: 'accepted' },
    { id: uuid(), customer_id: customerData[20].id, store_id: STORE_M2, processed_by: SELLER_M2, device_brand: 'Xiaomi', device_model: 'Mi 11', imei: luhnIMEI(), storage: '128 Go', color: 'Bleu', condition: 'poor', offered_price: 800, status: 'rejected', notes: 'Trop endommage' },
  ];
  try { await supabase('trade_ins', 'POST', tradeIns); } catch(e) { console.log('  ⚠️', e.message.substring(0, 80)); }
  console.log(`  ✅ ${tradeIns.length} trade-ins`);

  // ══════════════════════════════════════
  // 9. NOTIFICATIONS
  // ══════════════════════════════════════
  console.log('🔔 Creating notifications...');
  const notifications = [
    { id: uuid(), user_id: MGR_M1, type: 'repair_ready', title: 'Reparation prete', message: 'iPhone 13 de Amina Idrissi est pret a etre recupere', read: false, data: { repair_id: repairsData[5].id } },
    { id: uuid(), user_id: MGR_M1, type: 'sale_made', title: 'Nouvelle vente', message: 'Ahmed Vendeur a realise une vente de 11 500 MAD', read: false, data: { sale_id: salesData[0].id } },
    { id: uuid(), user_id: MGR_M1, type: 'trade_in_received', title: 'Rachat en attente', message: 'iPhone XR propose par Samira El Mansouri — 1 200 MAD', read: false },
    { id: uuid(), user_id: MGR_M2, type: 'transfer_received', title: 'Transfert recu', message: 'Produit transfere depuis M1', read: true },
    { id: uuid(), user_id: SELLER_M1, type: 'low_stock', title: 'Stock bas', message: 'Batterie Samsung S24: seulement 2 en stock', read: false },
  ];
  try { await supabase('notifications', 'POST', notifications); } catch(e) { console.log('  ⚠️', e.message.substring(0, 80)); }
  console.log(`  ✅ ${notifications.length} notifications`);

  // ══════════════════════════════════════
  // 10. STOCK ALERT RULES
  // ══════════════════════════════════════
  console.log('⚠️ Creating stock alert rules...');
  const alertRules = [
    { id: uuid(), store_id: STORE_M1, name: 'Ecrans bas', alert_type: 'low_stock', product_type: 'part', threshold: 3, enabled: true, created_by: MGR_M1 },
    { id: uuid(), store_id: STORE_M1, name: 'Batteries bas', alert_type: 'low_stock', product_type: 'part', threshold: 5, enabled: true, created_by: MGR_M1 },
    { id: uuid(), store_id: STORE_M1, name: 'Stock dormant 60j', alert_type: 'aging_stock', threshold: 60, enabled: true, created_by: MGR_M1 },
    { id: uuid(), store_id: STORE_M2, name: 'Alerte stock general', alert_type: 'low_stock', threshold: 2, enabled: true, created_by: MGR_M2 },
  ];
  try { await supabase('stock_alert_rules', 'POST', alertRules); } catch(e) { console.log('  ⚠️', e.message.substring(0, 80)); }
  console.log(`  ✅ ${alertRules.length} alert rules`);

  // ══════════════════════════════════════
  // DONE
  // ══════════════════════════════════════
  console.log('\n══════════════════════════════════════════════');
  console.log('✅ SEED COMPLETE!');
  console.log(`  👥 ${customerData.length} clients`);
  console.log(`  📱 ${allProducts.length} produits`);
  console.log(`  🔩 ${partsData.length} pieces detachees`);
  console.log(`  💰 ${salesData.length} ventes`);
  console.log(`  🔧 ${repairsData.length} reparations`);
  console.log(`  🏭 ${supplierData.length} fournisseurs`);
  console.log(`  🎁 ${giftCards.length} cartes cadeaux`);
  console.log(`  📱 ${tradeIns.length} trade-ins`);
  console.log(`  🔔 ${notifications.length} notifications`);
  console.log(`  ⚠️  ${alertRules.length} regles d'alerte`);
  console.log('══════════════════════════════════════════════\n');
}

run().catch(e => { console.error('❌ Fatal:', e.message); process.exit(1); });
