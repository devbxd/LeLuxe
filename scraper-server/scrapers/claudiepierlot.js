const { chromium } = require("playwright");
const { classifyDept } = require("./_shared");

const CATEGORIES = [
    "https://fr.claudiepierlot.com/fr/pret-a-porter-voir-tout/",
    "https://fr.claudiepierlot.com/fr/chaussures-voir-tout/",
    "https://fr.claudiepierlot.com/fr/categories/tous-les-sacs/",
    "https://fr.claudiepierlot.com/fr/accessoires/tous-les-accessoires/",
    "https://fr.claudiepierlot.com/fr/categories/ceintures/",
    "https://fr.claudiepierlot.com/fr/categories/casquettes-et-bobs/",
    "https://fr.claudiepierlot.com/fr/categories/lunettes-de-soleil/",
    "https://fr.claudiepierlot.com/fr/categories/robes/",
    "https://fr.claudiepierlot.com/fr/categories/tops-et-chemises/",
    "https://fr.claudiepierlot.com/fr/categories/pantalons-et-jeans/",
    "https://fr.claudiepierlot.com/fr/categories/jupes-et-shorts/",
    "https://fr.claudiepierlot.com/fr/categories/t-shirts/",
    "https://fr.claudiepierlot.com/fr/categories/blousons-et-vestes-2/",
    "https://fr.claudiepierlot.com/fr/categories/blazers/",
    "https://fr.claudiepierlot.com/fr/categories/pulls-et-cardigans/",
    "https://fr.claudiepierlot.com/fr/categories/manteaux/",
    "https://fr.claudiepierlot.com/fr/collections/ensembles/",
    "https://fr.claudiepierlot.com/fr/collections/denim/",
    "https://fr.claudiepierlot.com/fr/collections/tailleurs/",
    "https://fr.claudiepierlot.com/fr/categories/petite-maroquinerie/",
    "https://fr.claudiepierlot.com/fr/categories/echarpes--foulards-et-cols/",
    "https://fr.claudiepierlot.com/fr/categories/bijoux-et-accessoires-cheveux/"
];

async function scrapeOneCategory(page, url, collected){

    await page.goto(url,{ waitUntil:"domcontentloaded", timeout:60000 });
    await page.waitForTimeout(5000);

    let stable=0, last=0;
    for(let i=0;i<40 && stable<6;i++){
        await page.mouse.wheel(0,1200);
        await page.waitForTimeout(600);
        const c = await page.evaluate(()=>document.querySelectorAll("[data-pid]").length);
        if(c===last) stable++; else stable=0;
        last=c;
    }

    const products = await page.evaluate(()=>{
        let data=[];
        document.querySelectorAll("[data-pid]").forEach(tile=>{
            let gtm = tile.getAttribute("data-gtmga4data");
            if(!gtm) return;
            let info;
            try{ info = JSON.parse(gtm); }catch(e){ return; }
            if(!info.item_name) return;

            let img = tile.querySelector("img");
            let image = img ? (img.currentSrc || img.src) : "";
            if(!image) return;

            let a = tile.querySelector("a.js-tile-anchor") || tile.querySelector("a");
            let link = a ? a.href : "";

            data.push({
                name: info.item_name,
                price: info.price ? `${info.price} €` : "Prix inconnu",
                image,
                url: link,
                category: info.item_category3 || info.item_category2 || ""
            });
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
            dept: classifyDept(p.name, classifyDept(p.category)),
            gender: "femme"
        });
    });

}

async function scrapeClaudiePierlot(url, brand, category){

    const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox'] });

    try{

        console.log("Ouverture Claudie Pierlot...");

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

module.exports = scrapeClaudiePierlot;
