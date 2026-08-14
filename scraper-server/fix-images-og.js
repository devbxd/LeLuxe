// Certaines fiches produit affichent une image secondaire (ex: semelle au
// lieu de la chaussure) parce que le scraper de liste a récupéré la
// mauvaise vignette. La page produit elle-même (non bloquée par l'anti-bot,
// contrairement à la page catégorie) expose toujours la bonne image via
// la balise <meta property="og:image">. On la relit produit par produit
// pour remplacer l'image par la vraie photo officielle.

const { fetchCatalog, saveBrand } = require('./supabaseStore');

const BRAND_NAME = process.argv[2];
if(!BRAND_NAME){
    console.log("Usage: node fix-images-og.js <BrandName>");
    process.exit(1);
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function getOgImage(url){
    try{
        const res = await fetch(url, {
            headers:{ "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" },
            signal: AbortSignal.timeout(15000)
        });
        if(!res.ok) return null;
        const html = await res.text();
        const m = html.match(/<meta property="og:image"\s+content="([^"]+)"/) || html.match(/<meta content="([^"]+)"\s+property="og:image"/);
        return m ? m[1] : null;
    }catch(e){ return null; }
}

async function main(){
    const DATA = await fetchCatalog();
    const brand = DATA.brands.find(b => b.name === BRAND_NAME);
    if(!brand){ console.log("Marque introuvable:", BRAND_NAME); return; }

    let changed = 0, failed = 0, checked = 0;

    for(const item of brand.items){
        if(!item.sourceUrl) continue;
        checked++;
        const og = await getOgImage(item.sourceUrl);
        if(og && og !== item.image){
            console.log("MAJ:", item.name, "\n  avant:", item.image, "\n  apres:", og);
            item.image = og;
            changed++;
        } else if(!og){
            failed++;
        }
        await sleep(250);
    }

    console.log(`\nVerifies: ${checked}, modifies: ${changed}, echecs: ${failed}`);

    const ok = await saveBrand(brand);
    console.log("save ok:", ok);
}

main().catch(e => { console.log("ERREUR:", e.message); process.exit(1); });
