// Reclassifie le champ `dept` de chaque article de chaque marque à partir
// de mots-clés dans le nom, pour remplacer le dept générique unique
// ("vetements") assigné lors du scraping par une catégorie précise
// (tshirt, short, casquette, sacs, chaussures...).

const SUPABASE_URL = "https://tyrvocpneofqbbcntmyq.supabase.co";
const SUPABASE_KEY = "sb_publishable_HJUwd63ym-pG91fhAGgVEQ_m3h1QH44";
const { classifyDept } = require('./scrapers/_shared');

function classify(name, fallback){
  return classifyDept(name, fallback);
}

async function main(){
  const skip = new Set(["Rolex", "Tiffany", "Zara"]); // déjà correctement catégorisées

  const res = await fetch(`${SUPABASE_URL}/rest/v1/catalog_store?id=eq.main&select=data`, {
    headers:{ apikey: SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}` }
  });
  const rows = await res.json();
  const DATA = rows[0].data;

  const report = {};

  DATA.brands.forEach(brand=>{
    if(skip.has(brand.name)) return;
    let changed = 0;
    brand.items.forEach(item=>{
      const newDept = classify(item.name, item.dept);
      if(newDept !== item.dept){
        item.dept = newDept;
        changed++;
      }
    });
    report[brand.name] = changed;
  });

  console.log(JSON.stringify(report, null, 2));

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

  console.log('save status:', putRes.status);
}

main().catch(e=>{ console.log('ERREUR:', e.message); process.exit(1); });
