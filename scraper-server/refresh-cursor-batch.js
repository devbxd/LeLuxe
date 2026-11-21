// Rafraichissement automatique periodique : traite un lot de marques a
// chaque execution, en repartant du point ou le lot precedent s'est arrete
// (curseur persiste dans Supabase, ligne 'refresh_cursor'), pour faire
// tourner l'integralite du catalogue sur plusieurs executions sans jamais
// lancer les 39 scrapers d'un coup. Pense pour etre appele par un cron
// GitHub Actions (.github/workflows/scrape-scheduled.yml).

const { mergeItemsIntoBrand } = require('./mergeLogic');
const { SUPABASE_URL, SUPABASE_KEY, fetchCatalog, saveBrand, bumpVersion } = require('./supabaseStore');

const SCRAPERS = {
  Lacoste: () => require('./scrapers/lacoste'),
  Zara: () => require('./scrapers/zara'),
  Uniqlo: () => require('./scrapers/uniqlo'),
  Veja: () => require('./scrapers/veja'),
  Chanel: () => require('./scrapers/chanel'),
  Gucci: () => require('./scrapers/gucci'),
  Versace: () => require('./scrapers/versace'),
  Balenciaga: () => require('./scrapers/balenciaga'),
  Givenchy: () => require('./scrapers/givenchy'),
  Burberry: () => require('./scrapers/burberry'),
  Rolex: () => require('./scrapers/rolex'),
  Tiffany: () => require('./scrapers/tiffany'),
  Jules: () => require('./scrapers/jules'),
  LaHalle: () => require('./scrapers/lahalle'),
  Maje: () => require('./scrapers/maje'),
  ArmaniExchange: () => require('./scrapers/armaniexchange'),
  BottegaVeneta: () => require('./scrapers/bottegaveneta'),
  Sandro: () => require('./scrapers/sandro'),
  ClaudiePierlot: () => require('./scrapers/claudiepierlot'),
  TheKooples: () => require('./scrapers/thekooples'),
  BaAndSh: () => require('./scrapers/bash'),
  COS: () => require('./scrapers/cos'),
  OtherStories: () => require('./scrapers/otherstories'),
  Arket: () => require('./scrapers/arket'),
  AmericanVintage: () => require('./scrapers/americanvintage'),
  Etam: () => require('./scrapers/etam'),
  Birkenstock: () => require('./scrapers/birkenstock'),
  MichaelKors: () => require('./scrapers/michaelkors'),
  JimmyChoo: () => require('./scrapers/jimmychoo'),
  Cartier: () => require('./scrapers/cartier'),
  Balmain: () => require('./scrapers/balmain'),
  Geox: () => require('./scrapers/geox'),
  SelfPortrait: () => require('./scrapers/selfportrait'),
  RickOwens: () => require('./scrapers/rickowens'),
  AmiParis: () => require('./scrapers/amiparis'),
  IsabelMarant: () => require('./scrapers/isabelmarant'),
  ParfumsDeMarly: () => require('./scrapers/parfumsdemarly'),
  Initio: () => require('./scrapers/initio'),
  Creed: () => require('./scrapers/creed')
};

const BRAND_NAMES = Object.keys(SCRAPERS);
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '8', 10);

function log(msg){ console.log(`[${new Date().toISOString()}] ${msg}`); }

async function getCursorIndex(){
  const res = await fetch(`${SUPABASE_URL}/rest/v1/catalog_store?id=eq.refresh_cursor&select=data`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const rows = await res.json();
  return (rows[0] && typeof rows[0].data.index === 'number') ? rows[0].data.index : 0;
}

async function setCursorIndex(index){
  await fetch(`${SUPABASE_URL}/rest/v1/catalog_store?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({ id: 'refresh_cursor', data: { index } })
  });
}

// "LeLuxe Newspaper" : resume factuel de la semaine, base uniquement sur
// les vraies donnees scrapees (pas d'IA generative, pas de cle API requise).
// Affiche sur le site dans le bandeau "LE LUXE EXCLUSIVE".
async function saveWeeklyNews(text){
  await fetch(`${SUPABASE_URL}/rest/v1/catalog_store?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({ id: 'weekly_news', data: { text, generatedAt: Date.now() } })
  }).catch(()=>{});
}
function buildWeeklyNews(byBrand){
  const entries = [...byBrand.values()].filter(e => e.added > 0).sort((a,b)=> b.added - a.added);
  if(entries.length === 0) return null;
  const sentences = entries.slice(0, 5).map(e=>{
    const pieceWord = e.added > 1 ? 'new pieces' : 'new piece';
    const examples = e.examples.length ? `, including ${e.examples.join(' and ')}` : '';
    return `${e.brand} added ${e.added} ${pieceWord}${examples}`;
  });
  return `This week on Le Luxe: ${sentences.join('. ')}.`;
}

async function main(){
  const runStartTime = Date.now();
  const newItemsByBrand = new Map();
  let start = await getCursorIndex();
  if(!(start >= 0) || start >= BRAND_NAMES.length) start = 0;

  const batch = [];
  for(let i = 0; i < BATCH_SIZE && i < BRAND_NAMES.length; i++){
    batch.push(BRAND_NAMES[(start + i) % BRAND_NAMES.length]);
  }
  const nextIndex = (start + batch.length) % BRAND_NAMES.length;
  await setCursorIndex(nextIndex);

  log(`Lot de ${batch.length}/${BRAND_NAMES.length} marques (index ${start} -> ${nextIndex}) : ${batch.join(', ')}`);

  // Catalogue lu UNE seule fois pour tout le lot (plusieurs Mo par lecture) :
  // le relire a chaque marque dans la boucle gaspillait jusqu'a 50x la bande
  // passante necessaire sur une seule execution hebdomadaire.
  const DATA = await fetchCatalog();

  const report = [];
  for(let i = 0; i < batch.length; i++){
    const brandName = batch[i];
    log(`(${i + 1}/${batch.length}) ${brandName}...`);
    try{
      const brand = DATA.brands.find(b => b.name.toLowerCase() === brandName.toLowerCase());
      if(!brand){
        log(`  -> marque introuvable dans le catalogue, ignoree.`);
        report.push({ brand: brandName, error: 'introuvable dans catalogue' });
        continue;
      }
      const scraperFn = SCRAPERS[brandName]();
      const before = brand.items.length;
      const scraped = await scraperFn('', brandName, 'refresh');
      const { added, updated } = mergeItemsIntoBrand(brand, scraped || [], 'vetements');
      const ok = await saveBrand(brand, { skipVersionBump: true });
      log(`  -> scrapes:${(scraped || []).length} | ajoutes:${added} | mis a jour:${updated} | total:${before}->${brand.items.length} | sauvegarde:${ok}`);
      report.push({ brand: brandName, scraped: (scraped || []).length, added, updated, total: brand.items.length, saved: ok });

      if(added > 0){
        const newNames = brand.items.filter(it => it.addedAt >= runStartTime).map(it => it.name).filter(Boolean);
        const prev = newItemsByBrand.get(brandName) || { brand: brandName, added: 0, examples: [] };
        prev.added += added;
        newNames.slice(0, 2).forEach(n => { if(prev.examples.length < 2) prev.examples.push(n); });
        newItemsByBrand.set(brandName, prev);
      }
    }catch(e){
      log(`  -> ERREUR: ${e.message}`);
      report.push({ brand: brandName, error: e.message });
    }
  }

  // Une seule notification aux visiteurs pour tout le lot, au lieu d'une
  // par marque (voir le commentaire sur skipVersionBump dans saveBrand).
  await bumpVersion().catch(()=>{});

  log('=== RAPPORT DU LOT ===');
  console.log(JSON.stringify(report, null, 2));
  const totalAdded = report.reduce((s, r) => s + (r.added || 0), 0);
  const totalUpdated = report.reduce((s, r) => s + (r.updated || 0), 0);
  const failed = report.filter(r => r.error);
  log(`Total: ${totalAdded} articles ajoutes, ${totalUpdated} mis a jour, ${failed.length} marques en erreur.`);

  const newsText = buildWeeklyNews(newItemsByBrand);
  if(newsText){
    await saveWeeklyNews(newsText);
    log(`LeLuxe Newspaper mis a jour: ${newsText}`);
  } else {
    log('LeLuxe Newspaper: aucun nouvel article cette semaine, pas de mise a jour.');
  }
}

main().catch(e => { log('ERREUR FATALE: ' + e.message); process.exit(1); });
