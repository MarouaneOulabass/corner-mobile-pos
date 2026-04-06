const SU = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SU || !SK) { console.error('Missing env'); process.exit(1); }

const M1='a0000000-0000-0000-0000-000000000001',M2='a0000000-0000-0000-0000-000000000002';
const S1='b0000000-0000-0000-0000-000000000004',S2='b0000000-0000-0000-0000-000000000005';

function uuid(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16);})}
function luhn(){const pf='35'+String(Math.floor(Math.random()*10))+String(Math.floor(Math.random()*10))+'00';let p=pf;for(let i=p.length;i<14;i++)p+=Math.floor(Math.random()*10);let s=0;for(let i=0;i<14;i++){let d=parseInt(p[i]);if(i%2===1){d*=2;if(d>9)d-=9;}s+=d;}return p+((10-(s%10))%10);}

async function ins(table, rows) {
  const allKeys = new Set();
  rows.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));
  const normalized = rows.map(r => {
    const o = {};
    for (const k of allKeys) o[k] = r[k] !== undefined ? r[k] : null;
    return o;
  });
  const res = await fetch(`${SU}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(normalized)
  });
  if (!res.ok) { console.log(`  ERR ${table}: ${(await res.text()).substring(0, 120)}`); return []; }
  return res.json();
}

async function get(table, params) {
  const res = await fetch(`${SU}/rest/v1/${table}?${params}`, {
    headers: { apikey: SK, Authorization: `Bearer ${SK}` }
  });
  return res.json();
}

async function run() {
  console.log('Seeding products, sales, repairs, trade-ins...\n');

  const supps = await get('suppliers', 'select=id&limit=1');
  const suppId = supps.length > 0 ? supps[0].id : null;
  const custs = await get('customers', 'select=id&limit=20');
  console.log(`Found ${custs.length} customers, suppId=${suppId ? 'yes' : 'none'}`);

  // Products
  const prods = [];
  const phones = [
    {b:'Apple',m:'iPhone 15 Pro Max',s:'256 Go',col:'Titane',cond:'like_new',pp:9500,sp:11500,w:6,bin:'Vitrine A1',st:M1},
    {b:'Apple',m:'iPhone 15 Pro',s:'128 Go',col:'Bleu',cond:'good',pp:7800,sp:9200,w:3,bin:'Vitrine A1',st:M1},
    {b:'Apple',m:'iPhone 14',s:'128 Go',col:'Minuit',cond:'good',pp:5200,sp:6500,w:3,bin:'Vitrine A2',st:M1},
    {b:'Apple',m:'iPhone 13',s:'128 Go',col:'Bleu',cond:'good',pp:3800,sp:4800,w:3,bin:'Vitrine A2',st:M1},
    {b:'Apple',m:'iPhone 12',s:'64 Go',col:'Noir',cond:'fair',pp:2200,sp:2900,w:0,bin:'Etagere B1',st:M1},
    {b:'Apple',m:'iPhone 11',s:'64 Go',col:'Blanc',cond:'good',pp:1800,sp:2400,w:0,bin:'Etagere B2',st:M1},
    {b:'Samsung',m:'Galaxy S24 Ultra',s:'256 Go',col:'Violet',cond:'like_new',pp:8500,sp:10500,w:6,bin:'Vitrine A3',st:M1},
    {b:'Samsung',m:'Galaxy S24',s:'128 Go',col:'Noir',cond:'new',pp:6000,sp:7500,w:12,bin:'Vitrine A3',st:M1},
    {b:'Samsung',m:'Galaxy A54',s:'128 Go',col:'Vert',cond:'good',pp:2200,sp:2900,w:3,bin:'Etagere C1',st:M1},
    {b:'Xiaomi',m:'Redmi Note 13 Pro',s:'256 Go',col:'Bleu',cond:'new',pp:2400,sp:3100,w:12,bin:'Etagere D1',st:M1},
    {b:'OPPO',m:'Reno 11',s:'256 Go',col:'Vert',cond:'new',pp:3000,sp:3800,w:12,bin:'Etagere E1',st:M1},
    {b:'Apple',m:'iPhone 15',s:'128 Go',col:'Rose',cond:'like_new',pp:6500,sp:7900,w:6,bin:'Vitrine 1',st:M2},
    {b:'Apple',m:'iPhone 14 Pro',s:'256 Go',col:'Or',cond:'good',pp:6800,sp:8200,w:3,bin:'Vitrine 1',st:M2},
    {b:'Samsung',m:'Galaxy S23',s:'128 Go',col:'Creme',cond:'good',pp:4500,sp:5600,w:3,bin:'Vitrine 2',st:M2},
    {b:'Samsung',m:'Galaxy A54 5G',s:'128 Go',col:'Violet',cond:'like_new',pp:2400,sp:3100,w:6,bin:'Etagere A',st:M2},
    {b:'Xiaomi',m:'14T',s:'256 Go',col:'Gris',cond:'new',pp:3200,sp:4000,w:12,bin:'Etagere B',st:M2},
  ];
  for (const p of phones) {
    prods.push({id:uuid(),imei:luhn(),product_type:'phone',brand:p.b,model:p.m,storage:p.s,color:p.col,condition:p.cond,purchase_price:p.pp,selling_price:p.sp,warranty_months:p.w,bin_location:p.bin,status:'in_stock',store_id:p.st,supplier_id:suppId,created_by:p.st===M1?S1:S2});
  }
  const accs = [
    {b:'Apple',m:'Coque iPhone 15 Pro',pp:30,sp:80,bin:'Tiroir Acc-1',st:M1},
    {b:'Samsung',m:'Coque Galaxy S24',pp:40,sp:120,bin:'Tiroir Acc-2',st:M1},
    {b:'Generique',m:'Verre trempe',pp:5,sp:30,bin:'Tiroir Acc-3',st:M1},
    {b:'Generique',m:'Chargeur USB-C',pp:25,sp:70,bin:'Tiroir Acc-4',st:M1},
    {b:'Generique',m:'Ecouteurs TWS',pp:40,sp:120,bin:'Tiroir Acc-5',st:M1},
    {b:'Generique',m:'Powerbank 10K',pp:60,sp:150,bin:'Tiroir Acc-5',st:M1},
    {b:'Apple',m:'Coque MagSafe',pp:50,sp:150,bin:'Rayon A',st:M2},
    {b:'Generique',m:'Support voiture',pp:20,sp:60,bin:'Rayon B',st:M2},
  ];
  for (const a of accs) {
    prods.push({id:uuid(),imei:null,product_type:'accessory',brand:a.b,model:a.m,storage:null,color:null,condition:'new',purchase_price:a.pp,selling_price:a.sp,warranty_months:0,bin_location:a.bin,status:'in_stock',store_id:a.st,supplier_id:null,created_by:a.st===M1?S1:S2});
  }
  const pi = await ins('products', prods);
  console.log(`Products: ${pi.length}`);

  // Sales
  if (custs.length >= 5 && pi.length >= 5) {
    const pAvail = pi.filter(p => p.product_type === 'phone').slice(0, 5);
    const sales = [], items = [];
    for (let i = 0; i < pAvail.length; i++) {
      const sid = uuid();
      const d = i % 3 === 0 ? Math.floor(pAvail[i].selling_price * 0.05) : 0;
      sales.push({id:sid,store_id:pAvail[i].store_id,seller_id:pAvail[i].store_id===M1?S1:S2,customer_id:custs[i].id,total:pAvail[i].selling_price-d,discount_amount:d,discount_type:d>0?'flat':null,payment_method:i%2===0?'cash':'card',payment_details:null,return_id:null});
      items.push({id:uuid(),sale_id:sid,product_id:pAvail[i].id,quantity:1,unit_price:pAvail[i].selling_price-d,original_price:pAvail[i].selling_price});
    }
    const sa = await ins('sales', sales);
    console.log(`Sales: ${sa.length}`);
    if (sa.length > 0) {
      const it = await ins('sale_items', items);
      console.log(`Sale items: ${it.length}`);
      for (const p of pAvail) {
        await fetch(`${SU}/rest/v1/products?id=eq.${p.id}`, {
          method: 'PATCH',
          headers: {apikey:SK,Authorization:`Bearer ${SK}`,'Content-Type':'application/json',Prefer:'return=minimal'},
          body: JSON.stringify({status:'sold'})
        });
      }
    }
  }

  // Repairs
  if (custs.length >= 10) {
    const reps = [
      {problem:'Ecran casse apres chute',problem_categories:['broken_screen'],device_brand:'Apple',device_model:'iPhone 13',estimated_cost:600,status:'received',deposit:180,final_cost:null},
      {problem:'Batterie gonflee',problem_categories:['battery'],device_brand:'Samsung',device_model:'Galaxy S23',estimated_cost:250,status:'diagnosing',deposit:75,final_cost:null},
      {problem:'Port de charge HS',problem_categories:['charging_port'],device_brand:'Apple',device_model:'iPhone 12',estimated_cost:150,status:'in_repair',deposit:45,final_cost:null},
      {problem:'Camera arriere floue',problem_categories:['camera'],device_brand:'Apple',device_model:'iPhone 14 Pro',estimated_cost:400,status:'ready',deposit:120,final_cost:null},
      {problem:'Degats des eaux',problem_categories:['water_damage'],device_brand:'Samsung',device_model:'Galaxy A54',estimated_cost:350,status:'delivered',deposit:105,final_cost:380},
    ].map((r, i) => ({
      id:uuid(),customer_id:custs[i+5].id,store_id:M1,technician_id:S1,
      device_brand:r.device_brand,device_model:r.device_model,imei:luhn(),
      problem:r.problem,problem_categories:r.problem_categories,
      condition_on_arrival:'Quelques rayures',status:r.status,
      estimated_cost:r.estimated_cost,final_cost:r.final_cost,deposit:r.deposit,
      estimated_completion_date:new Date(Date.now()+86400000*3).toISOString().split('T')[0],
      signature_url:null,pre_checklist:{},post_checklist:{},pre_photos:[],post_photos:[]
    }));
    const re = await ins('repairs', reps);
    console.log(`Repairs: ${re.length}`);
    if (re.length > 0) {
      const logs = re.map(r => ({id:uuid(),repair_id:r.id,status:'received',changed_by:S1,notes:null}));
      await ins('repair_status_log', logs);
    }
  }

  // Trade-ins
  if (custs.length >= 15) {
    const ti = await ins('trade_ins', [
      {id:uuid(),customer_id:custs[12].id,store_id:M1,processed_by:S1,device_brand:'Apple',device_model:'iPhone XR',imei:luhn(),storage:'64 Go',color:'Corail',condition:'fair',offered_price:1200,ai_suggested_price:1350,status:'pending',product_id:null,notes:null},
      {id:uuid(),customer_id:custs[14].id,store_id:M1,processed_by:S1,device_brand:'Samsung',device_model:'Galaxy S21',imei:luhn(),storage:'128 Go',color:'Gris',condition:'good',offered_price:2200,ai_suggested_price:null,status:'accepted',product_id:null,notes:null},
    ]);
    console.log(`Trade-ins: ${ti.length}`);
  }

  console.log('\nSeed complete!');
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
