const { chromium } = require("playwright");
const { classifyDept } = require("./_shared");

// Etam (marque femme)
const CATEGORIES = [
    "https://www.etam.com/c/lingerie/",
    "https://www.etam.com/c/lingerie/soutien-gorge/",
    "https://www.etam.com/c/lingerie/culotte-et-bas/",
    "https://www.etam.com/c/lingerie/body/",
    "https://www.etam.com/c/pret-a-porter/",
    "https://www.etam.com/c/maillot-de-bain-et-beachwear/",
    "https://www.etam.com/c/homewear-et-pyjama/",
    "https://www.etam.com/c/nouveautes/"
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
            const name = tile.querySelector(".productCard__nameTitleLink")?.textContent.replace(/\s+/g,' ').trim();
            const price = tile.querySelector(".pageDesigner__tuileProductPrice")?.textContent.replace(/\s+/g,' ').trim();
            const img = tile.querySelector("img");
            const image = img ? (img.currentSrc || img.src) : "";
            const a = tile.closest("a") || tile.querySelector("a");
            const link = a ? a.href : "";
            if(!name || !image) return;
            data.push({ name, price: price||"Prix inconnu", image, url: link });
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

async function scrapeEtam(url, brand, category){

    const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox'] });

    try{

        console.log("Ouverture Etam...");

        const collected = new Map();

        for(const catUrl of [url, ...CATEGORIES]){

            if(collected.size >= 300) break;

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

        const capped = Array.from(collected.values()).slice(0,300);

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

module.exports = scrapeEtam;
