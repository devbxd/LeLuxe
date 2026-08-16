const { chromium } = require("playwright");
const { classifyDept } = require("./_shared");

const CATEGORIES = [
    "https://www.cartier.com/fr-fr/jewellery/collections",
    "https://www.cartier.com/fr-fr/watches/collections"
];

async function scrapeOneCategory(page, url, collected){

    await page.goto(url, { waitUntil:"load", timeout:30000 });
    await page.waitForTimeout(8000);

    let stable=0, last=0;
    for(let i=0;i<40 && stable<8;i++){
        await page.mouse.wheel(0,1000);
        await page.waitForTimeout(700);
        const c = await page.evaluate(()=>document.querySelectorAll(".product-list__grid .product").length);
        if(c===last) stable++; else stable=0;
        last=c;
    }

    const isWatch = /watches/.test(url);

    const products = await page.evaluate(()=>{
        let data=[];
        document.querySelectorAll(".product-list__grid .product").forEach(tile=>{
            const name = tile.querySelector(".product__name")?.textContent.trim();
            const desc = tile.querySelector(".product__desc")?.textContent.trim();
            // le prix Cartier s'affiche avec un espace comme séparateur de
            // milliers ("12 500 €") : un regex qui ne capture qu'un seul
            // groupe de chiffres tronque le nombre (ex: "500 €" au lieu de
            // "12 500 €") -> on capture tous les groupes de chiffres avant le €
            const priceRe = /(\d{1,3}(?:[\s ]\d{3})*|\d+)([.,]\d+)?\s*(€|EUR)/;
            const priceEl = Array.from(tile.querySelectorAll("*")).find(e=>e.children.length===0 && priceRe.test(e.textContent||""));
            const priceMatch = priceEl ? priceEl.textContent.trim().match(priceRe) : null;
            const price = priceMatch ? priceMatch[0] : null;
            const img = tile.querySelector("img");
            const image = img ? (img.currentSrc || img.src) : "";
            const a = tile.closest("a") || tile.querySelector("a");
            const link = a ? a.href : "";
            if(!name || name==="Empty heading" || !image || !link) return;
            data.push({ name: desc?`${name} - ${desc}`:name, price: price||"Prix inconnu", image, url: link });
        });
        return data;
    });

    products.forEach(p=>{
        collected.set(p.url, {
            name: p.name,
            price: p.price,
            image: p.image,
            url: p.url,
            dept: "bijoux",
            gender: null
        });
    });

}

async function scrapeCartier(url, brand, category){

    const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox','--blink-settings=imagesEnabled=false'] });

    try{

        console.log("Ouverture Cartier...");

        const collected = new Map();

        for(const catUrl of [url, ...CATEGORIES]){

            const page = await browser.newPage({ viewport:{ width:1440, height:900 } });

            try{
                const before = collected.size;
                await scrapeOneCategory(page, catUrl, collected);
                console.log(catUrl, "->", collected.size-before, "produits (total", collected.size, ")");
            }catch(e){
                console.log("Erreur sur", catUrl, ":", e.message);
            }finally{
                await page.close();
            }

        }

        const capped = Array.from(collected.values());

        console.log("PRODUITS TROUVES:", capped.length);

        return capped;

    }catch(error){

        console.log("Erreur scraping:", error.message);
        return [];

    }
    finally{

        await browser.close();

    }

}

module.exports = scrapeCartier;
