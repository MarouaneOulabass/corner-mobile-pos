const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing env vars'); process.exit(1); }

const M1 = 'a0000000-0000-0000-0000-000000000001';
const M2 = 'a0000000-0000-0000-0000-000000000002';
const ADMIN = 'b0000000-0000-0000-0000-000000000001';
const MGR1 = 'b0000000-0000-0000-0000-000000000002';
const MGR2 = 'b0000000-0000-0000-0000-000000000003';
const S1 = 'b0000000-0000-0000-0000-000000000004';
const S2 = 'b0000000-0000-0000-0000-000000000005';

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function luhn() {
  const prefix = '35' + String(Math.floor(Math.random() * 10)) + String(Math.floor(Math.random() * 10)) + '00';
  let p = prefix;
  for (let i = p.length; i < 14; i++) p += Math.floor(Math.random() * 10);
  let sum = 0;
  for (let i = 0; i < 14; i++) { let d = parseInt(p[i]); if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; } sum += d; }
  return p + ((10 - (sum % 10)) % 10);
}

async function insert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) {
    const err = await res.text();
    console.log(`  ERR ${table}: ${err.substring(0, 100)}`);
    return [];
  }
  return res.json();
}

async function run() {
  console.log('Seeding Corner Mobile...\n');

  // 1. Customers
  const customerNames = [
    'Hassan Benali', 'Fatima Zahra Alaoui', 'Mohamed El Amrani', 'Khadija Bennani',
    'Youssef Tazi', 'Amina Idrissi', 'Omar Chraibi', 'Zineb El Fassi',
    'Rachid Lahlou', 'Salma Berrada', 'Karim Ouazzani', 'Nadia Sqalli',
    'Mehdi Benjelloun', 'Houda Filali', 'Amine Kettani', 'Samira Mansouri',
    'Hamza Belhaj', 'Laila Touri', 'Driss Chakir', 'Rim Aboutalib'
  ];
  const custs = customerNames.map((name, i) => ({
    id: uuid(), name,
    phone: '066' + String(1000000 + i * 111111).substring(0, 7),
    loyalty_tier: i < 2 ? 'gold' : i < 5 ? 'silver' : 'bronze',
    loyalty_points: i < 2 ? 2400 : i < 5 ? 800 : Math.floor(Math.random() * 200),
    store_credit: i === 0 ? 150 : 0
  }));
  const ci = await insert('customers', custs);
  console.log(`Customers: ${ci.length}`);

  // 2. Suppliers
  const supps = [
    { id: uuid(), name: 'TechMobile Casa', contact_name: 'Rachid M.', phone: '0522334455', email: 'contact@techmobile.ma', address: 'Casablanca', store_id: M1, created_by: ADMIN },
    { id: uuid(), name: 'PhoneStock Rabat', contact_name: 'Ali F.', phone: '0537221100', email: 'ali@phonestock.ma', address: 'Rabat', store_id: M1, created_by: ADMIN },
    { id: uuid(), name: 'iRepair Parts', contact_name: 'Hamid Z.', phone: '0661998877', email: 'hamid@irepair.com', address: 'Casablanca', store_id: M1, created_by: ADMIN },
  ];
  const si = await insert('suppliers', supps);
  console.log(`Suppliers: ${si.length}`);

  // 3. Products
  const prods = [];
  const phones = [
    { b:'Apple',m:'iPhone 15 Pro Max',s:'256 Go',col:'Titane',cond:'like_new',pp:9500,sp:11500,w:6,bin:'Vitrine A1',st:M1 },
    { b:'Apple',m:'iPhone 15 Pro',s:'128 Go',col:'Bleu',cond:'good',pp:7800,sp:9200,w:3,bin:'Vitrine A1',st:M1 },
    { b:'Apple',m:'iPhone 14',s:'128 Go',col:'Minuit',cond:'good',pp:5200,sp:6500,w:3,bin:'Vitrine A2',st:M1 },
    { b:'Apple',m:'iPhone 13',s:'128 Go',col:'Bleu',cond:'good',pp:3800,sp:4800,w:3,bin:'Vitrine A2',st:M1 },
    { b:'Apple',m:'iPhone 12',s:'64 Go',col:'Noir',cond:'fair',pp:2200,sp:2900,w:0,bin:'Etagere B1',st:M1 },
    { b:'Apple',m:'iPhone 11',s:'64 Go',col:'Blanc',cond:'good',pp:1800,sp:2400,w:0,bin:'Etagere B2',st:M1 },
    { b:'Samsung',m:'Galaxy S24 Ultra',s:'256 Go',col:'Violet',cond:'like_new',pp:8500,sp:10500,w:6,bin:'Vitrine A3',st:M1 },
    { b:'Samsung',m:'Galaxy S24',s:'128 Go',col:'Noir',cond:'new',pp:6000,sp:7500,w:12,bin:'Vitrine A3',st:M1 },
    { b:'Samsung',m:'Galaxy A54',s:'128 Go',col:'Vert',cond:'good',pp:2200,sp:2900,w:3,bin:'Etagere C1',st:M1 },
    { b:'Samsung',m:'Galaxy A14',s:'64 Go',col:'Blanc',cond:'new',pp:1200,sp:1600,w:12,bin:'Etagere C2',st:M1 },
    { b:'Xiaomi',m:'Redmi Note 13 Pro',s:'256 Go',col:'Bleu',cond:'new',pp:2400,sp:3100,w:12,bin:'Etagere D1',st:M1 },
    { b:'Xiaomi',m:'Poco X6 Pro',s:'256 Go',col:'Gris',cond:'like_new',pp:2600,sp:3300,w:6,bin:'Etagere D2',st:M1 },
    { b:'OPPO',m:'Reno 11',s:'256 Go',col:'Vert',cond:'new',pp:3000,sp:3800,w:12,bin:'Etagere E1',st:M1 },
    { b:'Apple',m:'iPhone 15',s:'128 Go',col:'Rose',cond:'like_new',pp:6500,sp:7900,w:6,bin:'Vitrine 1',st:M2 },
    { b:'Apple',m:'iPhone 14 Pro',s:'256 Go',col:'Or',cond:'good',pp:6800,sp:8200,w:3,bin:'Vitrine 1',st:M2 },
    { b:'Apple',m:'iPhone 13',s:'256 Go',col:'Vert',cond:'like_new',pp:4200,sp:5300,w:3,bin:'Vitrine 2',st:M2 },
    { b:'Samsung',m:'Galaxy S23',s:'128 Go',col:'Creme',cond:'good',pp:4500,sp:5600,w:3,bin:'Vitrine 2',st:M2 },
    { b:'Samsung',m:'Galaxy A54',s:'128 Go',col:'Violet',cond:'like_new',pp:2400,sp:3100,w:6,bin:'Etagere A',st:M2 },
    { b:'Xiaomi',m:'Redmi Note 13',s:'128 Go',col:'Bleu',cond:'new',pp:1600,sp:2100,w:12,bin:'Etagere B',st:M2 },
    { b:'Xiaomi',m:'14T',s:'256 Go',col:'Gris',cond:'new',pp:3200,sp:4000,w:12,bin:'Etagere B',st:M2 },
  ];
  for (const p of phones) {
    prods.push({
      id: uuid(), imei: luhn(), product_type: 'phone', brand: p.b, model: p.m,
      storage: p.s, color: p.col, condition: p.cond, purchase_price: p.pp,
      selling_price: p.sp, warranty_months: p.w, bin_location: p.bin,
      status: 'in_stock', store_id: p.st,
      supplier_id: si.length > 0 ? si[0].id : undefined,
      created_by: p.st === M1 ? S1 : S2
    });
  }

  const accs = [
    { b:'Apple',m:'Coque iPhone 15 Pro Silicone',pp:30,sp:80,bin:'Tiroir Acc-1',st:M1 },
    { b:'Samsung',m:'Coque Galaxy S24 Cuir',pp:40,sp:120,bin:'Tiroir Acc-2',st:M1 },
    { b:'Generique',m:'Verre trempe universel',pp:5,sp:30,bin:'Tiroir Acc-3',st:M1 },
    { b:'Generique',m:'Chargeur USB-C 20W',pp:25,sp:70,bin:'Tiroir Acc-4',st:M1 },
    { b:'Generique',m:'Ecouteurs Bluetooth TWS',pp:40,sp:120,bin:'Tiroir Acc-5',st:M1 },
    { b:'Generique',m:'Powerbank 10000mAh',pp:60,sp:150,bin:'Tiroir Acc-5',st:M1 },
    { b:'Apple',m:'Coque iPhone 15 MagSafe',pp:50,sp:150,bin:'Rayon A',st:M2 },
    { b:'Generique',m:'Support voiture magnetique',pp:20,sp:60,bin:'Rayon B',st:M2 },
  ];
  for (const a of accs) {
    prods.push({
      id: uuid(), product_type: 'accessory', brand: a.b, model: a.m,
      condition: 'new', purchase_price: a.pp, selling_price: a.sp,
      bin_location: a.bin, status: 'in_stock', store_id: a.st,
      created_by: a.st === M1 ? S1 : S2
    });
  }
  const pi = await insert('products', prods);
  console.log(`Products: ${pi.length} (${phones.length} phones, ${accs.length} accessories)`);

  // 4. Parts
  const parts = [
    { id:uuid(), name:'Ecran iPhone 13 OLED', category:'screen', compatible_brands:['Apple'], compatible_models:['iPhone 13'], quantity:5, min_quantity:3, purchase_price:350, selling_price:600, store_id:M1, bin_location:'Stock P-A1' },
    { id:uuid(), name:'Ecran Samsung A54', category:'screen', compatible_brands:['Samsung'], compatible_models:['Galaxy A54'], quantity:4, min_quantity:2, purchase_price:200, selling_price:400, store_id:M1, bin_location:'Stock P-A2' },
    { id:uuid(), name:'Batterie iPhone 13', category:'battery', compatible_brands:['Apple'], compatible_models:['iPhone 13'], quantity:8, min_quantity:5, purchase_price:80, selling_price:200, store_id:M1, bin_location:'Stock P-B1' },
    { id:uuid(), name:'Port charge Lightning', category:'charging_port', compatible_brands:['Apple'], compatible_models:['iPhone 11','iPhone 12','iPhone 13'], quantity:10, min_quantity:5, purchase_price:30, selling_price:100, store_id:M1, bin_location:'Stock P-C1' },
    { id:uuid(), name:'Camera iPhone 13', category:'camera', compatible_brands:['Apple'], compatible_models:['iPhone 13'], quantity:3, min_quantity:2, purchase_price:150, selling_price:350, store_id:M1, bin_location:'Stock P-D1' },
    { id:uuid(), name:'Haut-parleur iPhone', category:'speaker', compatible_brands:['Apple'], compatible_models:['iPhone 11','iPhone 12'], quantity:5, min_quantity:3, purchase_price:20, selling_price:60, store_id:M1, bin_location:'Stock P-E1' },
  ];
  const pa = await insert('parts_inventory', parts);
  console.log(`Parts: ${pa.length}`);

  // 5. Sales
  if (ci.length > 0 && pi.length > 0) {
    const phonesAvail = pi.filter(p => p.product_type === 'phone').slice(0, 5);
    const sales = [];
    const items = [];
    for (let i = 0; i < phonesAvail.length; i++) {
      const sid = uuid();
      const disc = i % 3 === 0 ? Math.floor(phonesAvail[i].selling_price * 0.05) : 0;
      sales.push({
        id: sid, store_id: phonesAvail[i].store_id,
        seller_id: phonesAvail[i].store_id === M1 ? S1 : S2,
        customer_id: ci[i].id,
        total: phonesAvail[i].selling_price - disc,
        discount_amount: disc,
        payment_method: i % 2 === 0 ? 'cash' : 'card'
      });
      items.push({
        id: uuid(), sale_id: sid, product_id: phonesAvail[i].id,
        quantity: 1, unit_price: phonesAvail[i].selling_price - disc,
        original_price: phonesAvail[i].selling_price
      });
    }
    const sa = await insert('sales', sales);
    console.log(`Sales: ${sa.length}`);
    if (sa.length > 0) {
      const it = await insert('sale_items', items);
      console.log(`Sale items: ${it.length}`);
      for (const p of phonesAvail) {
        await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${p.id}`, {
          method: 'PATCH',
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'sold' })
        });
      }
    }
  }

  // 6. Repairs
  if (ci.length >= 10) {
    const reps = [
      { problem:'Ecran casse apres chute', problem_categories:['broken_screen'], device_brand:'Apple', device_model:'iPhone 13', estimated_cost:600, status:'received', deposit:180 },
      { problem:'Batterie gonflee', problem_categories:['battery'], device_brand:'Samsung', device_model:'Galaxy S23', estimated_cost:250, status:'diagnosing', deposit:75 },
      { problem:'Port de charge HS', problem_categories:['charging_port'], device_brand:'Apple', device_model:'iPhone 12', estimated_cost:150, status:'in_repair', deposit:45 },
      { problem:'Camera arriere floue', problem_categories:['camera'], device_brand:'Apple', device_model:'iPhone 14 Pro', estimated_cost:400, status:'ready', deposit:120 },
      { problem:'Degats des eaux', problem_categories:['water_damage'], device_brand:'Samsung', device_model:'Galaxy A54', estimated_cost:350, status:'delivered', deposit:105, final_cost:380 },
    ].map((r, i) => ({
      id: uuid(), customer_id: ci[i + 5].id, store_id: M1, technician_id: S1,
      ...r, imei: luhn(), condition_on_arrival: 'Quelques rayures',
      estimated_completion_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    }));
    const re = await insert('repairs', reps);
    console.log(`Repairs: ${re.length}`);
    if (re.length > 0) {
      const logs = re.map(r => ({ id: uuid(), repair_id: r.id, status: 'received', changed_by: S1 }));
      await insert('repair_status_log', logs);
    }
  }

  // 7. Gift cards
  const gc = await insert('gift_cards', [
    { id:uuid(), code:'CORNER100', initial_amount:100, current_balance:100, store_id:M1, created_by:MGR1, status:'active' },
    { id:uuid(), code:'VIP2024', initial_amount:1000, current_balance:650, store_id:M1, created_by:ADMIN, status:'active' },
  ]);
  console.log(`Gift cards: ${gc.length}`);

  // 8. Trade-ins
  const ti = await insert('trade_ins', [
    { id:uuid(), store_id:M1, processed_by:S1, device_brand:'Apple', device_model:'iPhone XR', imei:luhn(), storage:'64 Go', color:'Corail', condition:'fair', offered_price:1200, ai_suggested_price:1350, status:'pending' },
    { id:uuid(), store_id:M1, processed_by:S1, device_brand:'Samsung', device_model:'Galaxy S21', imei:luhn(), storage:'128 Go', color:'Gris', condition:'good', offered_price:2200, status:'accepted' },
  ]);
  console.log(`Trade-ins: ${ti.length}`);

  // 9. Alert rules
  const ar = await insert('stock_alert_rules', [
    { id:uuid(), store_id:M1, name:'Ecrans bas', alert_type:'low_stock', threshold:3, enabled:true, created_by:MGR1 },
    { id:uuid(), store_id:M1, name:'Stock dormant', alert_type:'aging_stock', threshold:60, enabled:true, created_by:MGR1 },
  ]);
  console.log(`Alert rules: ${ar.length}`);

  // 10. Notifications
  const notifs = await insert('notifications', [
    { id:uuid(), user_id:MGR1, type:'repair_ready', title:'Reparation prete', message:'iPhone 14 Pro de Houda Filali est pret', read:false },
    { id:uuid(), user_id:MGR1, type:'sale_made', title:'Vente realisee', message:'Ahmed a vendu iPhone 15 Pro Max pour 11 500 MAD', read:false },
    { id:uuid(), user_id:S1, type:'low_stock', title:'Stock bas', message:'Camera iPhone 13: seulement 3 en stock', read:false },
    { id:uuid(), user_id:MGR1, type:'trade_in_received', title:'Rachat en attente', message:'iPhone XR propose a 1 200 MAD', read:false },
  ]);
  console.log(`Notifications: ${notifs.length}`);

  console.log('\n Done!');
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
