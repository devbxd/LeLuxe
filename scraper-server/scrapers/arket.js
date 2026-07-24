const { chromium } = require("playwright");
const { classifyDept, genderFromUrl, setCollectedItem } = require("./_shared");

const BASE = "https://www.arket.com";

const CATEGORIES = [
    "https://www.arket.com/fr-fr/women/clothing/dresses",
    "https://www.arket.com/fr-fr/women/clothing/shirts-and-blouses",
    "https://www.arket.com/fr-fr/women/clothing/trousers",
    "https://www.arket.com/fr-fr/women/clothing/jeans",
    "https://www.arket.com/fr-fr/women/clothing/tops",
    "https://www.arket.com/fr-fr/women/clothing/knitwear",
    "https://www.arket.com/fr-fr/women/clothing/coats-jackets",
    "https://www.arket.com/fr-fr/women/clothing/skirts",
    "https://www.arket.com/fr-fr/women/shoes",
    "https://www.arket.com/fr-fr/women/bags",
    "https://www.arket.com/fr-fr/women/accessories",
    "https://www.arket.com/fr-fr/men/clothing/shirts",
    "https://www.arket.com/fr-fr/men/clothing/trousers",
    "https://www.arket.com/fr-fr/men/clothing/knitwear",
    "https://www.arket.com/fr-fr/men/clothing/t-shirts",
    "https://www.arket.com/fr-fr/men/clothing/jeans",
    "https://www.arket.com/fr-fr/men/clothing/coats-jackets",
    "https://www.arket.com/fr-fr/men/shoes",
    "https://www.arket.com/fr-fr/men/accessories"
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
            price: p.price || null,
            image: (p.mediaObjects && p.mediaObjects[0] && p.mediaObjects[0].attributes && p.mediaObjects[0].attributes.media_original_url) || "",
            url: p.uri ? `${base}/fr-fr/product/${p.uri}/` : ""
        })).filter(p => p.name && p.image && p.url);
    }, BASE);

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

async function scrapeArket(url, brand, category){

    const browser = await chromium.launch({ headless:false });

    try{

        console.log("Ouverture Arket...");

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

module.exports = scrapeArket;
