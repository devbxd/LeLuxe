const { chromium } = require("playwright");
const { classifyDept, genderFromUrl, setCollectedItem } = require("./_shared");
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
    "https://www.thekooples.com/fr/fr/homme/pret-a-porter/costumes.html",
    "https://www.thekooples.com/fr/fr/femme/pret-a-porter/chemises-tops.html",
    "https://www.thekooples.com/fr/fr/femme/pret-a-porter/jupes-shorts.html",
    "https://www.thekooples.com/fr/fr/femme/pret-a-porter/pantalons.html",
    "https://www.thekooples.com/fr/fr/femme/pret-a-porter/t-shirts.html",
    "https://www.thekooples.com/fr/fr/femme/pret-a-porter/tailleurs.html",
    "https://www.thekooples.com/fr/fr/femme/accessoires/bijoux.html",
    "https://www.thekooples.com/fr/fr/femme/accessoires/ceintures.html",
    "https://www.thekooples.com/fr/fr/femme/accessoires/chaussures.html",
    "https://www.thekooples.com/fr/fr/homme/pret-a-porter/pantalons.html",
    "https://www.thekooples.com/fr/fr/homme/pret-a-porter/pulls-cardigans.html",
    "https://www.thekooples.com/fr/fr/homme/pret-a-porter/sweatshirts.html",
    "https://www.thekooples.com/fr/fr/homme/pret-a-porter/t-shirts.html",
    "https://www.thekooples.com/fr/fr/homme/pret-a-porter/vestes-blousons.html",
    "https://www.thekooples.com/fr/fr/homme/accessoires/casquettes.html",
    "https://www.thekooples.com/fr/fr/homme/accessoires/ceintures.html",
    "https://www.thekooples.com/fr/fr/homme/accessoires/chaussures.html",
    "https://www.thekooples.com/fr/fr/homme/accessoires/maroquinerie.html",
    "https://www.thekooples.com/fr/fr/homme/accessoires/montres-bijoux.html"
];

async function scrapeThekooples(url, brand, category){

    const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox'] });

    try{

        console.log("Ouverture The Kooples...");

        const collected = new Map();

        for(const catUrl of [url, ...CATEGORIES]){

            if(collected.size >= 1200) break;

            const page = await browser.newPage({ viewport:{ width:1440, height:900 } });

            try{
                await page.goto(catUrl, { waitUntil:"domcontentloaded", timeout:30000 });
                await page.waitForTimeout(3500);
                const items = await extractItemListFromPage(page);
                const before = collected.size;
                items.forEach(p=>{
                    if(!p.url) return;
                    setCollectedItem(collected, p.url, {
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

        const capped = Array.from(collected.values()).slice(0,1200);

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
