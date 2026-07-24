const { chromium } = require("playwright");
const { classifyDept, genderFromUrl } = require("./_shared");
const { extractItemListFromPage } = require("./_jsonld");

// The Kooples publie un JSON-LD ItemList complet (SEO) sur ses pages
// catégorie : tous les produits (avec prix) y sont déjà, sans scroll.
const CATEGORIES = [
    "https://www.thekooples.com/fr/fr/femme/pret-a-porter.html",
    "https://www.thekooples.com/fr/fr/femme/accessoires.html",
    "https://www.thekooples.com/fr/fr/homme/pret-a-porter/voir-tout.html",
    "https://www.thekooples.com/fr/fr/homme/accessoires.html",
    "https://www.thekooples.com/fr/fr/femme/pret-a-porter/robes.html",
    "https://www.thekooples.com/fr/fr/femme/pret-a-porter/jeans.html",
    "https://www.thekooples.com/fr/fr/femme/pret-a-porter/vestes-blousons.html",
    "https://www.thekooples.com/fr/fr/femme/pret-a-porter/pulls-cardigans.html",
    "https://www.thekooples.com/fr/fr/homme/pret-a-porter/manteaux-blousons.html",
    "https://www.thekooples.com/fr/fr/homme/pret-a-porter/chemises.html",
    "https://www.thekooples.com/fr/fr/homme/pret-a-porter/jeans.html",
    "https://www.thekooples.com/fr/fr/homme/pret-a-porter/costumes.html"
];

async function scrapeThekooples(url, brand, category){

    const browser = await chromium.launch({ headless:false });

    try{

        console.log("Ouverture The Kooples...");

        const collected = new Map();

        for(const catUrl of [url, ...CATEGORIES]){

            if(collected.size >= 400) break;

            const page = await browser.newPage({ viewport:{ width:1440, height:900 } });

            try{
                await page.goto(catUrl, { waitUntil:"domcontentloaded", timeout:30000 });
                await page.waitForTimeout(3500);
                const items = await extractItemListFromPage(page);
                const before = collected.size;
                items.forEach(p=>{
                    if(!p.url) return;
                    collected.set(p.url, {
                        name: p.name,
                        price: p.price,
                        image: p.image,
                        url: p.url,
                        dept: classifyDept(p.name),
                        gender: genderFromUrl(catUrl)
                    });
                });
                console.log(catUrl, "->", collected.size-before, "produits (total", collected.size, ")");
            }catch(e){
                console.log("Erreur sur", catUrl, ":", e.message);
            }finally{
                await page.close();
            }

        }

        const capped = Array.from(collected.values()).slice(0,400);

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

module.exports = scrapeThekooples;
