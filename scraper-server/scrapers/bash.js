const { chromium } = require("playwright");
const { classifyDept } = require("./_shared");

// ba&sh (marque femme uniquement)
const CATEGORIES = [
    "https://www.ba-sh.com/fr-fr/femme/vetements/",
    "https://www.ba-sh.com/fr-fr/femme/chaussures/",
    "https://www.ba-sh.com/fr-fr/femme/sacs/",
    "https://www.ba-sh.com/fr-fr/femme/accessoires/",
    "https://www.ba-sh.com/fr-fr/femme/robes/",
    "https://www.ba-sh.com/fr-fr/femme/pulls/",
    "https://www.ba-sh.com/fr-fr/femme/manteaux-et-vestes/",
    "https://www.ba-sh.com/fr-fr/femme/tops-et-chemises/",
    "https://www.ba-sh.com/fr-fr/femme/t-shirts/",
    "https://www.ba-sh.com/fr-fr/femme/pantalons/",
    "https://www.ba-sh.com/fr-fr/femme/jupes-et-shorts/",
    "https://www.ba-sh.com/fr-fr/femme/jeans/",
    "https://www.ba-sh.com/fr-fr/femme/bijoux/",
    "https://www.ba-sh.com/fr-fr/nouveautes/"
];

async function scrapeOneCategory(page, url, collected){

    await page.goto(url, { waitUntil:"load", timeout:40000 });
    await page.waitForTimeout(7000);

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
