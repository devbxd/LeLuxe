const { chromium } = require("playwright");
const { classifyDept, genderFromUrl, setCollectedItem } = require("./_shared");

const CATEGORIES = [
    "https://row.jimmychoo.com/fr_FR/femme/chaussures/",
    "https://row.jimmychoo.com/fr_FR/femme/sacs/",
    "https://row.jimmychoo.com/fr_FR/femme/accessoires/",
    "https://row.jimmychoo.com/fr_FR/homme/chaussures/"
];

async function scrapeOneCategory(page, url, collected){

    await page.goto(url, { waitUntil:"load", timeout:30000 });
    await page.waitForTimeout(5000);

    let stable=0, last=0;
    for(let i=0;i<40 && stable<6;i++){
        await page.mouse.wheel(0,1200);
        await page.waitForTimeout(600);
        const c = await page.evaluate(()=>document.querySelectorAll(".product-tile").length);
        if(c===last) stable++; else stable=0;
        last=c;
    }

    const products = await page.evaluate(()=>{
        let data=[];
        document.querySelectorAll(".product-tile").forEach(tile=>{
            const name = tile.querySelector('[class*=name],[class*=Name]')?.textContent.replace(/\s+/g,' ').trim();
            const price = tile.querySelector('[class*=price],[class*=Price]')?.textContent.replace(/\s+/g,' ').trim();
            const img = tile.querySelector("img");
            const image = img ? (img.currentSrc || img.src) : "";
            const a = tile.closest("a") || tile.querySelector("a");
            const link = a ? a.href : "";
            if(!name || !image || !link) return;
            data.push({ name, price: price||"Prix inconnu", image, url: link });
        });
        return data;
    });

    let urlDept = "vetements";
    if(/chaussures/.test(url)) urlDept = "chaussures";
    else if(/\/sacs\//.test(url)) urlDept = "sacs";
    else if(/accessoires/.test(url)) urlDept = "access";

    products.forEach(p=>{
        setCollectedItem(collected, p.url, {
            name: p.name,
            price: p.price,
            image: p.image,
            url: p.url,
            dept: classifyDept(p.name, urlDept),
            gender: genderFromUrl(url)
        });
    });

}

async function scrapeJimmyChoo(url, brand, category){

    const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox'] });

    try{

        console.log("Ouverture Jimmy Choo...");

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

module.exports = scrapeJimmyChoo;
