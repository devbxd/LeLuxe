// Usage: node push-to-supabase.js <BrandName> <category> <jsonFile>
// Merge-upserts scraped {name, price, image, url} items into the Supabase
// catalog_store, matching existing items by sourceUrl (same logic as
// dashboard.html's mergeImportedProducts / parsePrice).

const SUPABASE_URL = "https://tyrvocpneofqbbcntmyq.supabase.co";
const SUPABASE_KEY = "sb_publishable_HJUwd63ym-pG91fhAGgVEQ_m3h1QH44";

function parsePrice(raw){
  if(typeof raw !== 'string') return null;

  const euroMid = raw.match(/(\d+)\s*€\s*(\d+)/);
  if(euroMid && !/[.,]/.test(raw)){
    const v = parseFloat(euroMid[1] + '.' + euroMid[2]);
    return isNaN(v) ? null : v;
  }

  let s = raw.replace(/[€\s ]/g,'');
  const match = s.match(/[\d.,]+/);
  if(!match) return null;
  let num = match[0];

  if(num.includes(',')){
    num = num.replace(/\./g,'').replace(',', '.');
  } else if(num.includes('.')){
    const parts = num.split('.');
    if(parts[parts.length-1].length === 3){
      num = parts.join('');
    }
  }

  const v = parseFloat(num);
  return isNaN(v) ? null : v;
}

function genId(){
  return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2,9);
}

async function main(){
  const [,, brandName, category, jsonFile, universeArg] = process.argv;
  if(!brandName || !category || !jsonFile){
    console.log("Usage: node push-to-supabase.js <BrandName> <category> <jsonFile> [universe]");
    process.exit(1);
  }

  const scraped = JSON.parse(require('fs').readFileSync(jsonFile, 'utf8'));

  const res = await fetch(`${SUPABASE_URL}/rest/v1/catalog_store?id=eq.main&select=data`, {
    headers:{ apikey: SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}` }
  });
  const rows = await res.json();
  const DATA = rows[0] ? rows[0].data : { brands: [] };

  let brand = DATA.brands.find(b => b.name.toLowerCase() === brandName.toLowerCase());
  if(!brand){
    brand = { id: genId(), name: brandName, universe: universeArg || 'luxe', items: [] };
    DATA.brands.push(brand);
  }

  const existingByUrl = new Map(brand.items.filter(it=>it.sourceUrl).map(it=>[it.sourceUrl, it]));
  let added = 0, updated = 0;

  scraped.forEach(p=>{
    if(p.url && existingByUrl.has(p.url)){
      const existing = existingByUrl.get(p.url);
      existing.name = p.name || existing.name;
      existing.price = parsePrice(p.price);
      existing.image = p.image || existing.image;
      existing.dept = p.dept || existing.dept;
      updated++;
      return;
    }
    const newItem = {
      id: genId(),
      name: p.name || 'Produit',
      dept: p.dept || category,
      price: parsePrice(p.price),
      image: p.image || null,
      isNew: true,
      sourceUrl: p.url || null
    };
    brand.items.push(newItem);
    if(p.url) existingByUrl.set(p.url, newItem);
    added++;
  });

  const putRes = await fetch(`${SUPABASE_URL}/rest/v1/catalog_store?on_conflict=id`, {
    method:'POST',
    headers:{
      apikey: SUPABASE_KEY,
      Authorization:`Bearer ${SUPABASE_KEY}`,
      'Content-Type':'application/json',
      'Prefer':'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({ id:'main', data: DATA })
  });

  console.log('added:', added, 'updated:', updated, 'total final:', brand.items.length, '| save status:', putRes.status);
}

main().catch(e=>{ console.log('ERREUR:', e.message); process.exit(1); });
