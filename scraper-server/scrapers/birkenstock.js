const { chromium } = require("playwright");
const { classifyDept, genderFromUrl, setCollectedItem } = require("./_shared");

const CATEGORIES = [
    "https://www.birkenstock.com/fr/femmes/sandales/",
    "https://www.birkenstock.com/fr/femmes/chaussures/",
    "https://www.birkenstock.com/fr/femmes/chaussons/",
    "https://www.birkenstock.com/fr/hommes/sandales/",
    "https://www.birkenstock.com/fr/hommes/chaussures/",
    "https://www.birkenstock.com/fr/hommes/chaussons/"
];

async function scrapeOneCategory(page, url, collected){

    await page.goto(url, { waitUntil:"load", timeout:30000 });
    await page.waitForTimeout(5000);

    let stable=0, last=0;
    for(let i=0;i<30 && stable<6;i++){
        await page.mouse.wheel(0,1200);
        await page.waitForTimeout(600);
        const c = await page.evaluate(()=>document.querySelectorAll("[data-pid]").length);
        if(c===last) stable++; else stable=0;
        last=c;
    }

    const products = await page.evaluate(()=>{
        let data=[];
        document.querySelectorAll("[data-pid]").forEach(tile=>{
            const title = tile.querySelector(".b-product_tile-title")?.textContent.trim();
            const aux = tile.querySelector(".b-product_tile-aux_name")?.textContent.trim();
            const name = [title, aux].filter(Boolean).join(" - ");
            const priceEl = tile.querySelector('[class*=price],[class*=Price]');
            const m = priceEl ? priceEl.textContent.match(/[\d,.]+\s*€/) : null;
            const img = tile.querySelector("img");
            const image = img ? (img.currentSrc || img.src) : "";
            const a = tile.closest("a") || tile.querySelector("a");
            const link = a ? a.href : "";
            if(!name || !image || !link) return;
            data.push({ name, price: m?m[0]:"Prix inconnu", image, url: link });
        });
        return data;
    });

    products.forEach(p=>{
        setCollectedItem(collected, p.url, {
            name: p.name,
            price: p.price,
            image: p.image,
            url: p.url,
            dept: "chaussures",
            gender: genderFromUrl(url.replace('hommes','homme').replace('femmes','femme'))
        });
    });

}

async function scrapeBirkenstock(url, brand, category){

    const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox','--blink-settings=imagesEnabled=false'] });

    try{

        console.log("Ouverture Birkenstock...");

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

module.exports = scrapeBirkenstock;
