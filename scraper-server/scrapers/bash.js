const { chromium } = require("playwright");
const { classifyDept } = require("./_shared");

// ba&sh (marque femme uniquement)
// L'ancienne liste utilisait "ba-sh.com/fr-fr/femme/..." (tiret + segment
// "femme") : ce sont des URLs perimees qui ne remontent presque rien. La
// vraie structure du site (verifiee dans le menu de navigation reel) est
// "ba-sh.com/fr/fr/<categorie>/", sans segment "femme".
const CATEGORIES = [
    "https://ba-sh.com/fr/fr/new-arrivals/",
    "https://ba-sh.com/fr/fr/robes/",
    "https://ba-sh.com/fr/fr/vestes-manteaux/",
    "https://ba-sh.com/fr/fr/tops-chemises/",
    "https://ba-sh.com/fr/fr/pulls-cardigans/",
    "https://ba-sh.com/fr/fr/denim/",
    "https://ba-sh.com/fr/fr/jupes-shorts/",
    "https://ba-sh.com/fr/fr/pantalons-jeans/",
    "https://ba-sh.com/fr/fr/combinaisons/",
    "https://ba-sh.com/fr/fr/t-shirts/",
    "https://ba-sh.com/fr/fr/sweatshirts/",
    "https://ba-sh.com/fr/fr/pret-a-porter/ensembles/",
    "https://ba-sh.com/fr/fr/accessoires/sacs/",
    "https://ba-sh.com/fr/fr/accessoires/chaussures/",
    "https://ba-sh.com/fr/fr/accessoires/lunettes-de-soleil/",
    "https://ba-sh.com/fr/fr/accessoires/ceintures/",
    "https://ba-sh.com/fr/fr/accessoires/bijoux-montres/",
    "https://ba-sh.com/fr/fr/accessoires/chapeaux-casquettes/",
    "https://ba-sh.com/fr/fr/accessoires/accessoires-cheveux-foulards/"
];

async function scrapeOneCategory(page, url, collected){

    await page.goto(url, { waitUntil:"load", timeout:40000 });
    await page.waitForTimeout(7000);

    // Sans defilement, seule la premiere fournee de produits (chargement
    // paresseux) est presente dans le DOM : on descend la page jusqu'a ce
    // que le nombre de tuiles se stabilise, comme les autres scrapers.
    let stable=0, last=0;
    for(let i=0;i<30 && stable<6;i++){
        await page.mouse.wheel(0,1200);
        await page.waitForTimeout(700);
        const c = await page.evaluate(()=>document.querySelectorAll(".ProductTile").length);
        if(c===last) stable++; else stable=0;
        last=c;
    }

    const products = await page.evaluate(()=>{
        let data=[];
        document.querySelectorAll(".ProductTile").forEach(tile=>{
            const a = tile.querySelector("a.js-productClick-tag") || tile.querySelector("a");
            if(!a) return;
            const name = a.getAttribute("data-gtm-productname") || a.getAttribute("title") || "";
            const price = a.getAttribute("data-gtm-productprice");
            const img = tile.querySelector("img");
            const image = img ? (img.currentSrc || img.src) : "";
            if(!name || !image) return;
            data.push({
                name,
                price: price ? `${price} €` : "Prix inconnu",
                image,
                url: a.href
            });
        });
        return data;
    });

    products.forEach(p=>{
        let key = p.url || p.image;
        if(!key) return;
        collected.set(key, {
            name: p.name,
            price: p.price,
            image: p.image,
            url: p.url,
            dept: classifyDept(p.name),
            gender: "femme"
        });
    });

}

async function scrapeBash(url, brand, category){

    console.log("Ouverture ba&sh...");

    const collected = new Map();

    for(const catUrl of [url, ...CATEGORIES]){

        // un navigateur neuf par catégorie (pas juste un contexte) : le site
        // semble bloquer après la première navigation d'un même processus
        const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox'] });
        const page = await browser.newPage({ viewport:{ width:1440, height:900 } });

        try{
            const before = collected.size;
            await scrapeOneCategory(page, catUrl, collected);
            console.log(catUrl, "->", collected.size-before, "produits (total", collected.size, ")");
        }catch(e){
            console.log("Erreur sur", catUrl, ":", e.message);
        }finally{
            await browser.close();
        }

    }

    const capped = Array.from(collected.values());

    console.log("PRODUITS TROUVES:", capped.length);

    return capped;

}

module.exports = scrapeBash;
