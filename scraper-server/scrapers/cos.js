const { chromium } = require("playwright");
const { classifyDept } = require("./_shared");
const { extractNextDataProducts } = require("./_nextdata");

const BASE = "https://www.cos.com/fr-fr";

const CATEGORIES = [
    "https://www.cos.com/fr-fr/women/view-all",
    "https://www.cos.com/fr-fr/women/bags",
    "https://www.cos.com/fr-fr/women/shoes",
    "https://www.cos.com/fr-fr/women/jewellery",
    "https://www.cos.com/fr-fr/women/sunglasses",
    "https://www.cos.com/fr-fr/women/belts",
    "https://www.cos.com/fr-fr/men/view-all",
    "https://www.cos.com/fr-fr/men/bags-and-wallets",
    "https://www.cos.com/fr-fr/men/shoes",
    "https://www.cos.com/fr-fr/men/jewellery",
    "https://www.cos.com/fr-fr/men/sunglasses",
    "https://www.cos.com/fr-fr/women/tops",
    "https://www.cos.com/fr-fr/women/trousers",
    "https://www.cos.com/fr-fr/women/knitwear",
    "https://www.cos.com/fr-fr/women/jeans",
    "https://www.cos.com/fr-fr/women/shirts",
    "https://www.cos.com/fr-fr/women/t-shirts",
    "https://www.cos.com/fr-fr/women/coats-and-jackets",
    "https://www.cos.com/fr-fr/men/t-shirts",
    "https://www.cos.com/fr-fr/men/trousers",
    "https://www.cos.com/fr-fr/men/shirts",
    "https://www.cos.com/fr-fr/men/knitwear",
    "https://www.cos.com/fr-fr/men/jeans",
    "https://www.cos.com/fr-fr/men/coats-and-jackets"
];

function genderFromCategoryUri(uri){
    if(/^women/.test(uri)) return "femme";
    if(/^men/.test(uri)) return "homme";
    return null;
}

async function scrapeCos(url, brand, category){

    const browser = await chromium.launch({ headless:false });

    try{

        console.log("Ouverture COS...");

        const collected = new Map();

        for(const catUrl of [url, ...CATEGORIES]){

            const page = await browser.newPage({ viewport:{ width:1440, height:900 } });

            try{
                await page.goto(catUrl, { waitUntil:"load", timeout:30000 });
                await page.waitForTimeout(4500);
                const items = await extractNextDataProducts(page, BASE);
                const before = collected.size;
                items.forEach(p=>{
                    if(!p.url) return;
                    collected.set(p.url, {
                        name: p.name,
                        price: p.price,
                        image: p.image,
                        url: p.url,
                        dept: classifyDept(p.name),
                        gender: genderFromCategoryUri(p.categoryUri)
                    });
                });
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

module.exports = scrapeCos;
