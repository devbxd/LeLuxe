const { chromium } = require("playwright");
const { classifyDept } = require("./_shared");

const BASE = "https://www.stories.com";

// & Other Stories (marque femme uniquement) — même famille de plateforme que
// COS mais le bloc produit s'appelle "productList" avec un tableau "products".
const CATEGORIES = [
    "https://www.stories.com/fr-fr/clothing/",
    "https://www.stories.com/fr-fr/clothing/dresses/",
    "https://www.stories.com/fr-fr/clothing/tops/",
    "https://www.stories.com/fr-fr/clothing/trousers/",
    "https://www.stories.com/fr-fr/clothing/jeans/",
    "https://www.stories.com/fr-fr/clothing/knitwear/",
    "https://www.stories.com/fr-fr/clothing/jackets-coats/",
    "https://www.stories.com/fr-fr/clothing/skirts/",
    "https://www.stories.com/fr-fr/clothing/blouses-shirts/",
    "https://www.stories.com/fr-fr/accessories/",
    "https://www.stories.com/fr-fr/bags/",
    "https://www.stories.com/fr-fr/shoes/"
];

async function scrapeOneCategory(page, url, collected){

    await page.goto(url, { waitUntil:"load", timeout:30000 });
    await page.waitForTimeout(4500);

    const products = await page.evaluate((base) => {
        const el = document.querySelector('#__NEXT_DATA__');
        if(!el) return [];
        let json;
        try{ json = JSON.parse(el.textContent); }catch(e){ return []; }
        const pl = (json.props?.pageProps?.blocks||[]).find(b => b && b.component === 'productList');
        if(!pl || !Array.isArray(pl.products)) return [];
        return pl.products.map(p => ({
            name: p.name,
            price: p.lowestPrice?.formattedValue || p.price?.formattedValue || null,
            image: (p.images && p.images[0] && p.images[0].url) || "",
            url: p.uri ? base + p.uri : ""
        })).filter(p => p.name && p.image && p.url);
    }, BASE);

    products.forEach(p=>{
        collected.set(p.url, {
            name: p.name,
            price: p.price,
            image: p.image,
            url: p.url,
            dept: classifyDept(p.name),
            gender: "femme"
        });
    });

}

async function scrapeOtherStories(url, brand, category){

    const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox','--blink-settings=imagesEnabled=false'] });

    try{

        console.log("Ouverture & Other Stories...");

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

module.exports = scrapeOtherStories;
