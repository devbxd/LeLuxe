const { chromium } = require("playwright");
const { setCollectedItem } = require("./_shared");


// Uniqlo charge les fiches produit un peu paresseusement : sur certaines
// tuiles, seul un badge ("Disponible fin juil.", "Bestseller"...) est
// rendu avant que le vrai nom n'apparaisse. On filtre ces badges et on
// combine plusieurs catégories pour avoir assez de produits. Chaque URL
// est étiquetée homme/femme pour que les articles héritent du bon genre.
const EXTRA_CATEGORIES = [
    ["https://www.uniqlo.com/fr/fr/men/tops", "homme"],
    ["https://www.uniqlo.com/fr/fr/men/bottoms", "homme"],
    ["https://www.uniqlo.com/fr/fr/men/outerwear", "homme"],
    ["https://www.uniqlo.com/fr/fr/men/accessories", "homme"],
    ["https://www.uniqlo.com/fr/fr/women/tops", "femme"],
    ["https://www.uniqlo.com/fr/fr/women/bottoms", "femme"],
    ["https://www.uniqlo.com/fr/fr/women/outerwear", "femme"],
    ["https://www.uniqlo.com/fr/fr/women/dresses-and-skirts", "femme"],
    ["https://www.uniqlo.com/fr/fr/women/accessories", "femme"]
];


function parseTile(text){

    let lines = text
        .split("\n")
        .map(x=>x.trim())
        .filter(Boolean);

    let priceRegex = /(\d[\d.,]*\s*€|€\s*[\d.,]+)/;

    // certaines fiches affichent un prix d'échange/promo ("1 €") avant le
    // vrai prix ("19,90 €") : on garde la ligne-prix la plus élevée plutôt
    // que la première trouvée, sinon on récupère le prix promo à tort
    let priceLines = lines.filter(l=>priceRegex.test(l));
    let price = "Prix inconnu";
    if(priceLines.length){
        price = priceLines.reduce((best, l)=>{
            const v = parseFloat((l.match(priceRegex)[0]||"").replace(/[€\s]/g,'').replace(',','.'));
            const bestV = parseFloat((best.match(priceRegex)[0]||"").replace(/[€\s]/g,'').replace(',','.'));
            return (isNaN(bestV) || (!isNaN(v) && v>bestV)) ? l : best;
        }, priceLines[0]);
    }
    let priceIndex = lines.indexOf(price);

    let banned = /^(bestseller|nouveau|new|nouveautés?|homme|femme|enfant|xs-?\d*xl|-?\d+%|disponible.*|prix en baisse|meilleure vente|exclusivit[ée].*|(homme|femme|enfant|b[ée]b[ée])[,\s].*)$/i;

    let sizeRange = /\d+\s*(inch|cm)\s*-\s*\d+\s*(inch|cm)/i;

    let candidates = lines.filter((l,i)=>
        i!==priceIndex &&
        l.length>2 &&
        !banned.test(l) &&
        !sizeRange.test(l) &&
        !priceRegex.test(l)
    );

    let name = candidates.sort((a,b)=>b.length-a.length)[0] || null;

    return { name, price };

}


function extractVisibleTiles(){

    let data=[];

    document.querySelectorAll(".product-tile").forEach(tile=>{

        let img = tile.querySelector("img");

        if(!img) return;

        let text = tile.innerText || "";

        if(!text.trim()) return;

        let a = tile.closest("a") || tile.querySelector("a");

        let link = a ? a.href : "";

        let image = img.currentSrc || img.src || "";

        if(!image) return;

        data.push({ text, image, url:link });

    });

    return data;

}


async function scrapeOneCategory(page, url, gender, collected){

    await page.goto(url,{
        waitUntil:"domcontentloaded",
        timeout:60000
    });

    await page.waitForTimeout(5000);

    // grille partiellement virtualisée : on accumule les tuiles au fur et à
    // mesure du scroll (au lieu d'extraire une seule fois à la fin, ce qui
    // ratait les tuiles du haut redevenues des coquilles vides)
    (await page.evaluate(extractVisibleTiles)).forEach(p=>{ if(p.url) setCollectedItem(collected, p.url, {...p, gender}); });

    let stable=0, last=0;

    for(let i=0;i<80 && (stable<12 || i<10);i++){

        await page.mouse.wheel(0,1200);

        await page.waitForTimeout(700);

        (await page.evaluate(extractVisibleTiles)).forEach(p=>{ if(p.url) setCollectedItem(collected, p.url, {...p, gender}); });

        const c = await page.evaluate(()=>document.querySelectorAll(".product-tile").length);

        if(c===last) stable++; else stable=0;

        last=c;

    }

}


async function scrapeUniqlo(url, brand, category){

    const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox'] });

    try{

        console.log("Ouverture Uniqlo...");

        const collected = new Map();

        for(const [catUrl, gender] of EXTRA_CATEGORIES){

            const page = await browser.newPage({ viewport:{ width:1440, height:900 } });

            try{
                const before = collected.size;
                await scrapeOneCategory(page, catUrl, gender, collected);
                console.log(catUrl, "->", collected.size-before, "tuiles brutes (total", collected.size, ")");
            }catch(e){
                console.log("Erreur sur", catUrl, ":", e.message);
            }finally{
                await page.close();
            }

        }

        const withNames = [];

        collected.forEach(p=>{

            let { name, price } = parseTile(p.text);

            if(!name) return; // pas de vrai nom trouvé (juste un badge) -> on saute

            withNames.push({ name, price, image:p.image, url:p.url, gender:p.gender });

        });

        console.log("PRODUITS TROUVES:", withNames.length);

        return withNames;

    }catch(error){

        console.log("Erreur scraping:", error.message);
        return [];

    }
    finally{

        await browser.close();

    }

}


module.exports = scrapeUniqlo;
