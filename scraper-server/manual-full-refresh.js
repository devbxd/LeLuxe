// Rattrapage manuel : le robot automatique (Render) est suspendu depuis
// ~3 semaines (quota de bande passante depasse), donc plus aucune marque
// n'a ete rescrapee depuis. Ce script relance les 39 scrapers un par un
// depuis ce poste, en attendant que Render soit reactive, et sauvegarde
// chaque marque individuellement des qu'elle est traitee (jamais tout le
// catalogue d'un coup) pour ne rien perdre si le script est interrompu.

const { mergeItemsIntoBrand } = require('./mergeLogic');
const { fetchCatalog, saveBrand } = require('./supabaseStore');

const SCRAPERS = {
  Lacoste: require("./scrapers/lacoste"),
  Zara: require("./scrapers/zara"),
  Uniqlo: require("./scrapers/uniqlo"),
  Veja: require("./scrapers/veja"),
  Chanel: require("./scrapers/chanel"),
  Gucci: require("./scrapers/gucci"),
  Versace: require("./scrapers/versace"),
  Balenciaga: require("./scrapers/balenciaga"),
  Givenchy: require("./scrapers/givenchy"),
  Burberry: require("./scrapers/burberry"),
  Rolex: require("./scrapers/rolex"),
  Tiffany: require("./scrapers/tiffany"),
  Jules: require("./scrapers/jules"),
  LaHalle: require("./scrapers/lahalle"),
  Maje: require("./scrapers/maje"),
  ArmaniExchange: require("./scrapers/armaniexchange"),
  BottegaVeneta: require("./scrapers/bottegaveneta"),
  Sandro: require("./scrapers/sandro"),
  ClaudiePierlot: require("./scrapers/claudiepierlot"),
  TheKooples: require("./scrapers/thekooples"),
  BaAndSh: require("./scrapers/bash"),
  COS: require("./scrapers/cos"),
  OtherStories: require("./scrapers/otherstories"),
  Arket: require("./scrapers/arket"),
  AmericanVintage: require("./scrapers/americanvintage"),
  Etam: require("./scrapers/etam"),
  Birkenstock: require("./scrapers/birkenstock"),
  MichaelKors: require("./scrapers/michaelkors"),
  JimmyChoo: require("./scrapers/jimmychoo"),
  Cartier: require("./scrapers/cartier"),
  Balmain: require("./scrapers/balmain"),
  Geox: require("./scrapers/geox"),
  SelfPortrait: require("./scrapers/selfportrait"),
  RickOwens: require("./scrapers/rickowens"),
  AmiParis: require("./scrapers/amiparis"),
  IsabelMarant: require("./scrapers/isabelmarant"),
  ParfumsDeMarly: require("./scrapers/parfumsdemarly"),
  Initio: require("./scrapers/initio"),
  Creed: require("./scrapers/creed")
};

function log(msg){
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function main(){
  const names = Object.keys(SCRAPERS);
  const report = [];
  log(`Debut du rattrapage : ${names.length} marques a traiter.`);

  for(let i=0;i<names.length;i++){
    const brandName = names[i];
    log(`(${i+1}/${names.length}) ${brandName}...`);
    try{
      const DATA = await fetchCatalog();
      const brand = DATA.brands.find(b=> b.name.toLowerCase()===brandName.toLowerCase());
      if(!brand){
        log(`  -> marque introuvable dans le catalogue, ignoree.`);
        report.push({ brand: brandName, error: 'introuvable' });
        continue;
      }
      const scraperFn = SCRAPERS[brandName];
      const before = brand.items.length;
      const scraped = await scraperFn('', brandName, 'vetements');
      const { added, updated } = mergeItemsIntoBrand(brand, scraped || [], 'vetements');
      const ok = await saveBrand(brand);
      log(`  -> scrapes:${(scraped||[]).length} | ajoutes:${added} | mis a jour:${updated} | total:${before}->${brand.items.length} | sauvegarde:${ok}`);
      report.push({ brand: brandName, scraped: (scraped||[]).length, added, updated, total: brand.items.length, saved: ok });
    }catch(e){
      log(`  -> ERREUR: ${e.message}`);
      report.push({ brand: brandName, error: e.message });
    }
  }

  log('=== RAPPORT FINAL ===');
  console.log(JSON.stringify(report, null, 2));
  const totalAdded = report.reduce((s,r)=> s+(r.added||0), 0);
  const totalUpdated = report.reduce((s,r)=> s+(r.updated||0), 0);
  const failed = report.filter(r=>r.error);
  log(`Total: ${totalAdded} articles ajoutes, ${totalUpdated} mis a jour, ${failed.length} marques en erreur.`);
}

main().catch(e=>{ log('ERREUR FATALE: '+e.message); process.exit(1); });
