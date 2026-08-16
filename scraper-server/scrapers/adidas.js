const { chromium } = require("playwright");
const { classifyDept, genderFromUrl, setCollectedItem } = require("./_shared");

const CATEGORIES = [
    "https://www.adidas.fr/homme-chaussures",
    "https://www.adidas.fr/homme-vetements",
    "https://www.adidas.fr/homme-accessoires",
    "https://www.adidas.fr/femme-chaussures",
    "https://www.adidas.fr/femme-vetements"
];

async function scrapeOneCategory(page, url, collected){

    await page.goto(url, { waitUntil:"load", timeout:30000 });
    await page.waitForTimeout(6000);

    let stable=0, last=0;
    for(let i=0;i<30 && stable<6;i++){
        await page.mouse.wheel(0,1200);
        await page.waitForTimeout(700);
        const c = await page.evaluate(()=>document.querySelectorAll('[class*="_product-card_"]').length);
        if(c===last) stable++; else stable=0;
        last=c;
    }

    const products = await page.evaluate(()=>{
        let data=[];
        document.querySelectorAll('[class*="_product-card_"]').forEach(tile=>{
            const name = tile.querySelector('[class*="__name"]')?.textContent.trim();
            const priceEl = Array.from(tile.querySelectorAll('*')).find(e=>e.children.length===0 && /\d+[.,]?\d*\s*€/.test(e.textContent||''));
            const price = priceEl ? priceEl.textContent.trim() : null;
            const img = tile.querySelector("img");
            const image = img ? (img.currentSrc || img.src) : "";
            const a = tile.querySelector("a") || tile.closest("a");
            const link = a ? a.href.split("?")[0] : "";
            if(!name || !image || !link) return;
            data.push({ name, price: price||"Prix inconnu", image, url: link });
        });
        return data;
    });

    products.forEach(p=>{
        setCollectedItem(collected, p.url, {
            name: p.name,
            price: p.price,
            image: p.image,
            url: p.url,
            dept: classifyDept(p.name),
            gender: genderFromUrl(url)
        });
    });

}

async function scrapeAdidas(url, brand, category){

    const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox'] });

    try{

        console.log("Ouverture Adidas...");

        const collected = new Map();

        for(const catUrl of [url, ...CATEGORIES]){

            if(collected.size >= 600) break;

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

        const capped = Array.from(collected.values()).slice(0,600);

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

module.exports = scrapeAdidas;
