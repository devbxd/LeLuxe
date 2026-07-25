// Usage: node push-to-supabase.js <BrandName> <category> <jsonFile>
// Merge-upserts scraped {name, price, image, url} items into the Supabase
// catalog_store, matching existing items by sourceUrl. Logique de fusion
// partagee avec server.js dans mergeLogic.js.

const SUPABASE_URL = "https://tyrvocpneofqbbcntmyq.supabase.co";
const SUPABASE_KEY = "sb_publishable_HJUwd63ym-pG91fhAGgVEQ_m3h1QH44";
const { genId, mergeItemsIntoBrand } = require('./mergeLogic');

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

  const { added, updated } = mergeItemsIntoBrand(brand, scraped, category);

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
