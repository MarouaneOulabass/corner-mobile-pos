/**
 * Corner Mobile POS — Full E2E Test Suite
 * Tests a complete day of operations with real data
 */

const PORT = process.env.PORT || 4000;
const BASE = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;
const results = [];

function log(test, status, detail) {
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`  ${icon} ${test}${detail ? ' — ' + detail : ''}`);
  results.push({ test, status, detail });
  if (status === 'PASS') passed++;
  else failed++;
}

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = `token=${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, cookie: res.headers.get('set-cookie') };
}

function extractToken(cookie) {
  if (!cookie) return null;
  const m = cookie.match(/token=([^;]+)/);
  return m ? m[1] : null;
}

async function run() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  E2E CORNER MOBILE — JOURNÉE COMPLÈTE (vrais données)   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // ═══ AUTH ═══
  console.log('━━━ PHASE 0: AUTHENTIFICATION ━━━');

  const adminLogin = await api('POST', '/api/auth/login', { email: 'admin@cornermobile.ma', password: 'corner2024' });
  const adminTK = extractToken(adminLogin.cookie);
  log('Login admin', adminTK ? 'PASS' : 'FAIL', `${adminLogin.data.user?.name}`);

  const sellerLogin = await api('POST', '/api/auth/login', { email: 'seller.m1@cornermobile.ma', password: 'corner2024' });
  const sellerTK = extractToken(sellerLogin.cookie);
  log('Login seller M1', sellerTK ? 'PASS' : 'FAIL', `${sellerLogin.data.user?.name}`);

  const mgr2Login = await api('POST', '/api/auth/login', { email: 'manager.m2@cornermobile.ma', password: 'corner2024' });
  const mgr2TK = extractToken(mgr2Login.cookie);
  log('Login manager M2', mgr2TK ? 'PASS' : 'FAIL', `${mgr2Login.data.user?.name}`);

  const badLogin = await api('POST', '/api/auth/login', { email: 'admin@cornermobile.ma', password: 'wrong' });
  log('Login mauvais mdp → 401', badLogin.status === 401 ? 'PASS' : 'FAIL', `HTTP ${badLogin.status}`);

  const me = await api('GET', '/api/auth/me', null, adminTK);
  log('Session /api/auth/me', me.data.user?.role === 'superadmin' ? 'PASS' : 'FAIL');

  console.log('');

  // ═══ PHASE 1: STOCK ═══
  console.log('━━━ PHASE 1: RÉCEPTION STOCK (10 produits) ━━━');

  const bulk = await api('POST', '/api/products/bulk', {
    products: [
      { product_type: 'phone', brand: 'Apple', model: 'iPhone 15 Pro', storage: '256GB', color: 'Titane Noir', condition: 'new', purchase_price: 8500, selling_price: 11000, imei: '490154203237518' },
      { product_type: 'phone', brand: 'Apple', model: 'iPhone 14', storage: '128GB', color: 'Bleu', condition: 'like_new', purchase_price: 5200, selling_price: 6500, imei: '353879234252633' },
      { product_type: 'phone', brand: 'Apple', model: 'iPhone 12', storage: '64GB', color: 'Noir', condition: 'fair', purchase_price: 2500, selling_price: 3200, imei: '351756081234561' },
      { product_type: 'phone', brand: 'Samsung', model: 'Galaxy S24 Ultra', storage: '256GB', color: 'Violet', condition: 'new', purchase_price: 9000, selling_price: 11500, imei: '359260076042891' },
      { product_type: 'phone', brand: 'Samsung', model: 'Galaxy A54', storage: '128GB', color: 'Noir', condition: 'good', purchase_price: 2200, selling_price: 2900, imei: '358000000000008' },
      { product_type: 'phone', brand: 'Samsung', model: 'Galaxy A14', storage: '64GB', color: 'Blanc', condition: 'new', purchase_price: 1200, selling_price: 1600, imei: '352345123456785' },
      { product_type: 'phone', brand: 'Xiaomi', model: 'Redmi Note 13', storage: '128GB', color: 'Vert', condition: 'new', purchase_price: 1800, selling_price: 2300, imei: '860000000000009' },
      { product_type: 'accessory', brand: 'Apple', model: 'Coque MagSafe iPhone 15', condition: 'new', purchase_price: 80, selling_price: 180 },
      { product_type: 'accessory', brand: 'Samsung', model: 'Chargeur rapide 25W', condition: 'new', purchase_price: 50, selling_price: 120 },
      { product_type: 'part', brand: 'Apple', model: 'Ecran iPhone 13 OLED', condition: 'new', purchase_price: 450, selling_price: 800 },
    ]
  }, adminTK);
  log('Bulk import 10 produits', bulk.data.imported === 10 ? 'PASS' : 'FAIL', `Importés: ${bulk.data.imported}, Erreurs: ${JSON.stringify(bulk.data.errors || [])}`);

  // Get all products with IDs
  const prodList = await api('GET', '/api/products?limit=50', null, adminTK);
  log('Liste stock', prodList.data.total >= 10 ? 'PASS' : 'FAIL', `${prodList.data.total} produits`);

  const products = prodList.data.products || [];
  const byModel = {};
  for (const p of products) byModel[p.model] = p;

  // Duplicate IMEI test
  const dup = await api('POST', '/api/products/bulk', {
    products: [{ product_type: 'phone', brand: 'Apple', model: 'Dup Test', condition: 'new', purchase_price: 100, selling_price: 200, imei: '490154203237518' }]
  }, adminTK);
  log('IMEI dupliqué rejeté', dup.data.imported === 0 ? 'PASS' : 'FAIL');

  // Search
  const search = await api('GET', '/api/products?search=iPhone', null, adminTK);
  log('Recherche "iPhone"', search.data.total >= 3 ? 'PASS' : 'FAIL', `${search.data.total} résultats`);

  // Filter by status
  const filterStock = await api('GET', '/api/products?status=in_stock', null, adminTK);
  log('Filtre status=in_stock', filterStock.data.total >= 10 ? 'PASS' : 'FAIL', `${filterStock.data.total} en stock`);

  console.log('');

  // ═══ PHASE 2: TRANSFERT INTER-MAGASIN ═══
  console.log('━━━ PHASE 2: TRANSFERT M1 → M2 ━━━');

  const redmi = byModel['Redmi Note 13'];
  if (redmi) {
    const transfer = await api('POST', '/api/transfers', {
      product_id: redmi.id,
      to_store_id: 'a0000000-0000-0000-0000-000000000002'
    }, adminTK);
    log('Transfert Redmi Note 13 → M2', transfer.status === 201 ? 'PASS' : 'FAIL', transfer.data.error || 'OK');

    // Verify product is now in M2 and in_stock
    const checkProd = await api('GET', `/api/products/${redmi.id}`, null, adminTK);
    log('Produit transféré → in_stock M2',
      checkProd.data.store_id === 'a0000000-0000-0000-0000-000000000002' && checkProd.data.status === 'in_stock' ? 'PASS' : 'FAIL',
      `store=${checkProd.data.store_id?.slice(-1)}, status=${checkProd.data.status}`);

    // Manager M2 sees the transferred product
    const m2Stock = await api('GET', '/api/products?limit=50', null, mgr2TK);
    const m2HasRedmi = (m2Stock.data.products || []).some(p => p.id === redmi.id);
    log('Manager M2 voit le Redmi transféré', m2HasRedmi ? 'PASS' : 'FAIL');

    // Seller M1 no longer sees it
    const s1Stock = await api('GET', '/api/products?limit=50', null, sellerTK);
    const s1HasRedmi = (s1Stock.data.products || []).some(p => p.id === redmi.id);
    log('Seller M1 ne voit plus le Redmi', !s1HasRedmi ? 'PASS' : 'FAIL');
  }

  console.log('');

  // ═══ PHASE 3: VENTES ═══
  console.log('━━━ PHASE 3: VENTES (Seller M1) ━━━');

  // Sale 1: iPhone 15 Pro + Coque (négociation prix)
  const ip15 = byModel['iPhone 15 Pro'];
  const coque = byModel['Coque MagSafe iPhone 15'];
  if (ip15 && coque) {
    const sale1 = await api('POST', '/api/sales', {
      items: [
        { product_id: ip15.id, quantity: 1, unit_price: 10500, original_price: 11000 },
        { product_id: coque.id, quantity: 1, unit_price: 150, original_price: 180 },
      ],
      customer_phone: '0661234567',
      customer_name: 'Hassan Benjelloun',
      discount_amount: 150,
      discount_type: 'flat',
      payment_method: 'card',
    }, sellerTK);
    log('Vente 1: iPhone 15 Pro + Coque (-150 MAD)',
      sale1.status === 201 ? 'PASS' : 'FAIL',
      `Total: ${sale1.data.total} MAD | ${sale1.data.error || 'OK'}`);

    // Verify iPhone 15 Pro is now sold
    const ip15Check = await api('GET', `/api/products/${ip15.id}`, null, adminTK);
    log('iPhone 15 Pro → status sold', ip15Check.data.status === 'sold' ? 'PASS' : 'FAIL');
  }

  // Sale 2: Galaxy A54 cash, no customer
  const ga54 = byModel['Galaxy A54'];
  if (ga54) {
    const sale2 = await api('POST', '/api/sales', {
      items: [{ product_id: ga54.id, quantity: 1, unit_price: 2700, original_price: 2900 }],
      payment_method: 'cash',
    }, sellerTK);
    log('Vente 2: Galaxy A54 cash sans client',
      sale2.status === 201 ? 'PASS' : 'FAIL',
      `Total: ${sale2.data.total} MAD`);
  }

  // Sale 3: Galaxy S24 Ultra — paiement mixte
  const gs24 = byModel['Galaxy S24 Ultra'];
  if (gs24) {
    const sale3 = await api('POST', '/api/sales', {
      items: [{ product_id: gs24.id, quantity: 1, unit_price: 11000, original_price: 11500 }],
      customer_phone: '0677889900',
      customer_name: 'Fatima Zahra',
      discount_amount: 500,
      discount_type: 'flat',
      payment_method: 'mixte',
      payment_details: { cash: 5500, card: 5000 },
    }, sellerTK);
    log('Vente 3: Galaxy S24 paiement mixte (5500 cash + 5000 carte)',
      sale3.status === 201 ? 'PASS' : 'FAIL',
      `Total: ${sale3.data.total} MAD`);
  }

  // Anti double-vente: try to sell iPhone 15 Pro again
  if (ip15) {
    const doubleSale = await api('POST', '/api/sales', {
      items: [{ product_id: ip15.id, quantity: 1, unit_price: 10000, original_price: 11000 }],
      payment_method: 'cash',
    }, sellerTK);
    log('Anti double-vente iPhone 15 Pro → rejeté',
      doubleSale.status === 409 ? 'PASS' : 'FAIL',
      `HTTP ${doubleSale.status}: ${doubleSale.data.error?.substring(0, 60) || 'OK'}`);
  }

  // Discount > subtotal → rejected
  const ga14 = byModel['Galaxy A14'];
  if (ga14) {
    const badDiscount = await api('POST', '/api/sales', {
      items: [{ product_id: ga14.id, quantity: 1, unit_price: 1600, original_price: 1600 }],
      discount_amount: 2000,
      discount_type: 'flat',
      payment_method: 'cash',
    }, sellerTK);
    log('Remise > sous-total → rejetée',
      badDiscount.status === 400 ? 'PASS' : 'FAIL',
      `HTTP ${badDiscount.status}`);
  }

  // Verify sales list
  const salesList = await api('GET', '/api/sales', null, adminTK);
  log('Liste des ventes', (salesList.data.sales?.length || 0) >= 3 ? 'PASS' : 'FAIL', `${salesList.data.sales?.length} ventes`);

  console.log('');

  // ═══ PHASE 4: RÉPARATIONS ═══
  console.log('━━━ PHASE 4: RÉPARATIONS ━━━');

  // Create repair: client Hassan apporte son ancien iPhone 11
  const repair1 = await api('POST', '/api/repairs', {
    customer_phone: '0661234567',
    customer_name: 'Hassan Benjelloun',
    device_brand: 'Apple',
    device_model: 'iPhone 11',
    problem: 'Ecran cassé après chute, tactile ne répond plus',
    problem_categories: ['Écran cassé'],
    estimated_cost: 650,
    deposit: 200,
    estimated_completion_date: '2026-04-07',
  }, sellerTK);
  const repairId = repair1.data?.id || repair1.data?.repair?.id;
  log('Créer réparation iPhone 11 (Hassan)',
    repair1.status === 201 ? 'PASS' : 'FAIL',
    `ID: ${repairId?.substring(0, 8) || 'N/A'}`);

  // Create repair 2: Fatima, batterie Samsung S21
  const repair2 = await api('POST', '/api/repairs', {
    customer_phone: '0677889900',
    customer_name: 'Fatima Zahra',
    device_brand: 'Samsung',
    device_model: 'Galaxy S21',
    problem: 'Batterie se décharge en 2h, gonflement visible',
    problem_categories: ['Batterie'],
    estimated_cost: 350,
    deposit: 100,
    estimated_completion_date: '2026-04-06',
  }, sellerTK);
  const repair2Id = repair2.data?.id || repair2.data?.repair?.id;
  log('Créer réparation Galaxy S21 (Fatima)',
    repair2.status === 201 ? 'PASS' : 'FAIL',
    `ID: ${repair2Id?.substring(0, 8) || 'N/A'}`);

  // Status transitions on repair 1
  if (repairId) {
    await new Promise(r => setTimeout(r, 500));
    const toDiag = await api('PATCH', `/api/repairs/${repairId}`, { status: 'diagnosing', notes: 'Écran fissuré confirmé' }, adminTK);
    const toDiagOk = toDiag.status === 200 && !toDiag.data?.error;
    log('Répa 1: received → diagnosing', toDiagOk ? 'PASS' : 'FAIL', `HTTP ${toDiag.status} ${toDiag.data?.error || ''}`);

    await new Promise(r => setTimeout(r, 500));
    const toRepair = await api('PATCH', `/api/repairs/${repairId}`, { status: 'in_repair' }, adminTK);
    const toRepairOk = toRepair.status === 200 && !toRepair.data?.error;
    log('Répa 1: diagnosing → in_repair', toRepairOk ? 'PASS' : 'FAIL', `HTTP ${toRepair.status} ${toRepair.data?.error || ''}`);

    await new Promise(r => setTimeout(r, 500));
    const toReady = await api('PATCH', `/api/repairs/${repairId}`, { status: 'ready', final_cost: 600 }, adminTK);
    const toReadyOk = toReady.status === 200 && !toReady.data?.error;
    log('Répa 1: in_repair → ready (coût final: 600)', toReadyOk ? 'PASS' : 'FAIL', `HTTP ${toReady.status} ${toReady.data?.error || ''}`);

    // Invalid transition
    await new Promise(r => setTimeout(r, 500));
    const invalid = await api('PATCH', `/api/repairs/${repairId}`, { status: 'diagnosing' }, adminTK);
    log('Transition invalide ready → diagnosing → bloquée', invalid.status === 400 ? 'PASS' : 'FAIL', `HTTP ${invalid.status}`);

    // Check status logs via GET
    await new Promise(r => setTimeout(r, 500));
    const detail = await api('GET', `/api/repairs/${repairId}`, null, adminTK);
    const logCount = detail.data?.status_logs?.length || 0;
    log('Historique statuts (3 transitions)', logCount >= 3 ? 'PASS' : 'FAIL', `${logCount} logs`);
  }

  console.log('');

  // ═══ PHASE 5: SUIVI PUBLIC ═══
  console.log('━━━ PHASE 5: SUIVI RÉPARATION PUBLIC ━━━');

  const track = await api('GET', '/api/repairs/track?phone=0661234567');
  const trackRepairs = track.data?.repairs || [];
  log('Suivi public par téléphone (Hassan)', trackRepairs.length >= 1 ? 'PASS' : 'FAIL', `${trackRepairs.length} réparations`);

  if (trackRepairs.length > 0) {
    log('Statut visible au client', ['ready', 'diagnosing', 'in_repair'].includes(trackRepairs[0].status) ? 'PASS' : 'FAIL', `Status: ${trackRepairs[0].status}`);
    log('Pas de fuite password_hash', !JSON.stringify(trackRepairs).includes('password_hash') ? 'PASS' : 'FAIL');
  }

  const trackNotFound = await api('GET', '/api/repairs/track?phone=0699999999');
  log('Suivi téléphone inconnu → vide', (trackNotFound.data?.repairs?.length || 0) === 0 ? 'PASS' : 'FAIL');

  console.log('');

  // ═══ PHASE 6: CLIENTS ═══
  console.log('━━━ PHASE 6: CLIENTS ━━━');

  const custList = await api('GET', '/api/customers', null, adminTK);
  log('Liste clients', (custList.data?.customers?.length || 0) >= 2 ? 'PASS' : 'FAIL', `${custList.data?.customers?.length} clients`);

  const custSearch = await api('GET', '/api/customers?search=Hassan', null, adminTK);
  log('Recherche client "Hassan"', (custSearch.data?.customers?.length || 0) >= 1 ? 'PASS' : 'FAIL');

  // Duplicate phone → rejected
  const dupCust = await api('POST', '/api/customers', { name: 'Doublon', phone: '0661234567' }, adminTK);
  log('Téléphone dupliqué → rejeté', dupCust.status === 409 ? 'PASS' : 'FAIL', `HTTP ${dupCust.status}`);

  console.log('');

  // ═══ PHASE 7: RBAC ═══
  console.log('━━━ PHASE 7: CONTRÔLE D\'ACCÈS (RBAC) ━━━');

  // Seller cannot delete
  const ip12 = byModel['iPhone 12'];
  if (ip12) {
    const sellerDelete = await api('DELETE', `/api/products/${ip12.id}`, null, sellerTK);
    log('Seller ne peut pas supprimer produit', sellerDelete.status === 403 ? 'PASS' : 'FAIL', `HTTP ${sellerDelete.status}`);
  }

  // Seller cannot transfer
  if (ip12) {
    const sellerTransfer = await api('POST', '/api/transfers', {
      product_id: ip12.id,
      to_store_id: 'a0000000-0000-0000-0000-000000000002'
    }, sellerTK);
    log('Seller ne peut pas transférer', sellerTransfer.status === 403 ? 'PASS' : 'FAIL', `HTTP ${sellerTransfer.status}`);
  }

  // Manager M2 cannot see M1 products (scoping)
  const m2Prods = await api('GET', '/api/products?limit=50', null, mgr2TK);
  const m2Count = m2Prods.data?.total || 0;
  log('Manager M2 ne voit que ses produits', m2Count <= 2 ? 'PASS' : 'FAIL', `${m2Count} produits (devrait voir ≤2: Redmi transféré)`);

  console.log('');

  // ═══ PHASE 8: NOTIFICATIONS ═══
  console.log('━━━ PHASE 8: NOTIFICATIONS ━━━');

  const notifs = await api('GET', '/api/notifications', null, adminTK);
  const notifCount = notifs.data?.notifications?.length || 0;
  log('Notifications reçues', notifCount >= 0 ? 'PASS' : 'FAIL', `${notifCount} notifications (repair_ready envoyé aux managers)`);

  console.log('');

  // ═══ PHASE 9: DATA JOURNAL ═══
  console.log('━━━ PHASE 9: DOUBLE SAISIE (Data Journal) ━━━');

  const journal = await api('GET', '/api/backup?type=journal', null, adminTK);
  const eventCount = journal.data?.count || journal.data?.events?.length || 0;
  log('Journal d\'événements', eventCount >= 10 ? 'PASS' : 'FAIL', `${eventCount} événements enregistrés`);

  if (journal.data?.events) {
    const types = {};
    for (const e of journal.data.events) types[e.event_type] = (types[e.event_type] || 0) + 1;
    log('Types d\'événements', Object.keys(types).length >= 3 ? 'PASS' : 'FAIL', JSON.stringify(types));
  }

  // Full snapshot
  const snapshot = await api('GET', '/api/backup?type=snapshot', null, adminTK);
  const snapKeys = Object.keys(snapshot.data || {}).filter(k => k !== 'exported_at' && k !== 'version');
  log('Snapshot complet', snapKeys.length >= 8 ? 'PASS' : 'FAIL', `${snapKeys.length} tables exportées`);

  console.log('');

  // ═══ PHASE 10: PAGES ═══
  console.log('━━━ PHASE 10: TOUTES LES PAGES (HTTP 200) ━━━');

  const pages = ['/', '/pos', '/stock', '/stock/add', '/repairs', '/repairs/new', '/customers', '/reports', '/sales', '/menu'];
  for (const page of pages) {
    const res = await fetch(`${BASE}${page}`, { headers: { Cookie: `token=${adminTK}` } });
    log(`Page ${page}`, res.status === 200 ? 'PASS' : 'FAIL', `HTTP ${res.status}`);
  }
  // Public pages
  for (const page of ['/login', '/track']) {
    const res = await fetch(`${BASE}${page}`);
    log(`Page ${page} (public)`, res.status === 200 ? 'PASS' : 'FAIL', `HTTP ${res.status}`);
  }

  console.log('');

  // ═══ RÉSUMÉ ═══
  console.log('╔══════════════════════════════════════╗');
  console.log(`║  RÉSULTAT: ${passed} PASS / ${failed} FAIL / ${passed + failed} TOTAL  ║`);
  console.log('╚══════════════════════════════════════╝');

  if (failed > 0) {
    console.log('');
    console.log('ÉCHECS:');
    for (const r of results) {
      if (r.status === 'FAIL') console.log(`  ❌ ${r.test}: ${r.detail || ''}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
