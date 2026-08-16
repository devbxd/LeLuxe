// Rattrapage cible : uniquement les marques dont l'IP de mon environnement
// habituel est bloquee (Access Denied / Akamai), lancees depuis une IP
// differente (GitHub Actions) pour voir si elles passent de la.

const { mergeItemsIntoBrand } = require('./mergeLogic');
const { fetchCatalog, saveBrand } = require('./supabaseStore');

const SCRAPERS = {
  Lacoste: require("./scrapers/lacoste"),
  Zara: require("./scrapers/zara"),
  Chanel: require("./scrapers/chanel"),
  Gucci: require("./scrapers/gucci"),
  Versace: require("./scrapers/versace"),
  Balenciaga: require("./scrapers/balenciaga"),
  Givenchy: require("./scrapers/givenchy"),
  Rolex: require("./scrapers/rolex"),
  Tiffany: require("./scrapers/tiffany"),
  LaHalle: require("./scrapers/lahalle"),
  ArmaniExchange: require("./scrapers/armaniexchange"),
  BottegaVeneta: require("./scrapers/bottegaveneta")
};

function log(msg){ console.log(`[${new Date().toISOString()}] ${msg}`); }

async function main(){
  const names = Object.keys(SCRAPERS);
  const report = [];
  log(`Rattrapage cible : ${names.length} marques.`);

  for(let i=0;i<names.length;i++){
    const brandName = names[i];
    log(`(${i+1}/${names.length}) ${brandName}...`);
    try{
      const DATA = await fetchCatalog();
      const brand = DATA.brands.find(b=> b.name.toLowerCase()===brandName.toLowerCase());
      if(!brand){ log(`  -> introuvable`); report.push({brand:brandName, error:'introuvable'}); continue; }
      const scraperFn = SCRAPERS[brandName];
      const before = brand.items.length;
      const scraped = await scraperFn('', brandName, 'vetements');
      const { added, updated } = mergeItemsIntoBrand(brand, scraped || [], 'vetements');
      const ok = await saveBrand(brand);
      log(`  -> scrapes:${(scraped||[]).length} | ajoutes:${added} | mis a jour:${updated} | total:${before}->${brand.items.length} | sauvegarde:${ok}`);
      report.push({ brand: brandName, scraped:(scraped||[]).length, added, updated, total: brand.items.length, saved: ok });
    }catch(e){
      log(`  -> ERREUR: ${e.message}`);
      report.push({ brand: brandName, error: e.message });
    }
  }

  log('=== RAPPORT ===');
  console.log(JSON.stringify(report, null, 2));
  const totalAdded = report.reduce((s,r)=> s+(r.added||0), 0);
  log(`Total ajoutes: ${totalAdded}`);
}

main().catch(e=>{ log('ERREUR FATALE: '+e.message); process.exit(1); });
