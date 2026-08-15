// Reclassifie le champ `dept` de chaque article de chaque marque à partir
// de mots-clés dans le nom, pour remplacer le dept générique unique
// ("vetements") assigné lors du scraping par une catégorie précise
// (tshirt, short, casquette, sacs, chaussures...).

const { classifyDept } = require('./scrapers/_shared');
const { normalizeDept } = require('./mergeLogic');
const { fetchCatalog, saveBrand } = require('./supabaseStore');

function classify(name, fallback, brand){
  return normalizeDept(classifyDept(name, fallback), brand);
}

async function main(){
  const skip = new Set(["Rolex", "Tiffany", "Zara"]); // déjà correctement catégorisées

  const DATA = await fetchCatalog();

  const report = {};
  const touched = [];

  DATA.brands.forEach(brand=>{
    if(skip.has(brand.name)) return;
    let changed = 0;
    brand.items.forEach(item=>{
      const newDept = classify(item.name, item.dept, brand);
      if(newDept !== item.dept){
        item.dept = newDept;
        changed++;
      }
    });
    report[brand.name] = changed;
    if(changed) touched.push(brand);
  });

  console.log(JSON.stringify(report, null, 2));

  let ok = 0;
  for(const brand of touched){
    if(await saveBrand(brand)) ok++;
  }
  console.log('sauvegardées:', ok, '/', touched.length);
}

main().catch(e=>{ console.log('ERREUR:', e.message); process.exit(1); });
