const { chromium } = require("playwright");
const { classifyDept, genderFromUrl, setCollectedItem } = require("./_shared");

const CATEGORIES = [
    "https://www.americanvintage-store.com/fr/en/women/",
    "https://www.americanvintage-store.com/fr/en/women-dresses/",
    "https://www.americanvintage-store.com/fr/en/women-t-shirts/",
    "https://www.americanvintage-store.com/fr/en/women-jumpers/",
    "https://www.americanvintage-store.com/fr/en/women-jackets/",
    "https://www.americanvintage-store.com/fr/en/women-trousers-jeans/",
    "https://www.americanvintage-store.com/fr/en/men/",
    "https://www.americanvintage-store.com/fr/en/men-t-shirts/",
    "https://www.americanvintage-store.com/fr/en/men-jumpers/",
    "https://www.americanvintage-store.com/fr/en/men-jackets/",
    "https://www.americanvintage-store.com/fr/en/men-trousers-jeans/",
    "https://www.americanvintage-store.com/fr/en/women-shirts/",
    "https://www.americanvintage-store.com/fr/en/women-skirts-shorts/",
    "https://www.americanvintage-store.com/fr/en/women-shoes-accessories/"
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
            const name = tile.querySelector(".product-tile-name")?.textContent.trim();
            const price = tile.querySelector(".product-tile-price")?.textContent.trim();
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
        setCollectedItem(collected, key, {
            name: p.name,
            price: p.price,
            image: p.image,
            url: p.url,
            dept: classifyDept(p.name),
            gender: genderFromUrl(url)
        });
    });

}

async function scrapeAmericanVintage(url, brand, category){

    const browser = await chromium.launch({ headless:false });

    try{

        console.log("Ouverture American Vintage...");

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

module.exports = scrapeAmericanVintage;
