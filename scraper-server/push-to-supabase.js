// Usage: node push-to-supabase.js <BrandName> <category> <jsonFile>
// Merge-upserts scraped {name, price, image, url} items into the Supabase
// catalog_store, matching existing items by sourceUrl. Logique de fusion
// partagee avec server.js dans mergeLogic.js.

const { genId, mergeItemsIntoBrand } = require('./mergeLogic');
const { fetchCatalog, saveBrand } = require('./supabaseStore');

async function main(){
  const [,, brandName, category, jsonFile, universeArg] = process.argv;
  if(!brandName || !category || !jsonFile){
    console.log("Usage: node push-to-supabase.js <BrandName> <category> <jsonFile> [universe]");
    process.exit(1);
  }

  const scraped = JSON.parse(require('fs').readFileSync(jsonFile, 'utf8'));

  const DATA = await fetchCatalog();

  let brand = DATA.brands.find(b => b.name.toLowerCase() === brandName.toLowerCase());
  if(!brand){
    brand = { id: genId(), name: brandName, universe: universeArg || 'luxe', items: [] };
    DATA.brands.push(brand);
  }

  const { added, updated } = mergeItemsIntoBrand(brand, scraped, category);

  const ok = await saveBrand(brand);

  console.log('added:', added, 'updated:', updated, 'total final:', brand.items.length, '| save ok:', ok);
}

main().catch(e=>{ console.log('ERREUR:', e.message); process.exit(1); });
