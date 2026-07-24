const { chromium } = require("playwright");
const { classifyDept, setCollectedItem } = require("./_shared");

const CATEGORIES = [
    "https://www.michaelkors.fr/femme-sacs/",
    "https://www.michaelkors.fr/femme-vetements/",
    "https://www.michaelkors.fr/femme-chaussures/",
    "https://www.michaelkors.fr/femme-accessoires/",
    "https://www.michaelkors.fr/femme-montres/",
    "https://www.michaelkors.fr/femme-bijoux/",
    "https://www.michaelkors.fr/homme-sacs/",
    "https://www.michaelkors.fr/homme-vetements/",
    "https://www.michaelkors.fr/homme-chaussures/",
    "https://www.michaelkors.fr/homme-montres/",
    "https://www.michaelkors.fr/homme-accessoires/"
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
            const img = tile.querySelector("img");
            const name = img ? img.alt : "";
            let image = img ? (img.getAttribute("data-src") || img.getAttribute("data-srcset") || img.currentSrc || img.src) : "";
            if(image) image = image.split(" ")[0];
            const priceEl = tile.querySelector('[class*=price],[class*=Price]');
            const m = priceEl ? priceEl.textContent.match(/[\d,.]+\s*€/) : null;
            const a = tile.closest("a") || tile.querySelector("a");
            const link = a ? a.href.split("?")[0] : "";
            if(!name || !image || /^data:/.test(image) || !link) return;
            data.push({ name, price: m?m[0]:"Prix inconnu", image, url: link });
        });
        return data;
    });
    const gender = /\/homme-/.test(url) ? "homme" : "femme";
    const fallbackDept = /-sacs\//.test(url) ? "sacs" : /-chaussures\//.test(url) ? "chaussures" : /-montres\//.test(url) ? "bijoux" : /-bijoux\//.test(url) ? "bijoux" : "vetements";
    products.forEach(p=>{
        setCollectedItem(collected, p.url, { name:p.name, price:p.price, image:p.image, url:p.url, dept: classifyDept(p.name,fallbackDept), gender });
    });
}

async function scrapeMichaelKors(url, brand, category){
    const browser = await chromium.launch({ headless:false });
    try{
        console.log("Ouverture Michael Kors...");
        const collected = new Map();
        for(const catUrl of [url, ...CATEGORIES]){
            const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
            try{
                const before = collected.size;
                await scrapeOneCategory(page, catUrl, collected);
                console.log(catUrl, "->", collected.size-before, "produits (total", collected.size, ")");
            }catch(e){ console.log("Erreur sur", catUrl, ":", e.message); }
            finally{ await page.close(); }
        }
        const capped = Array.from(collected.values());
        console.log("PRODUITS TROUVES:", capped.length);
        return capped;
    }catch(error){ console.log("Erreur scraping:", error.message); return []; }
    finally{ await browser.close(); }
}

module.exports = scrapeMichaelKors;
