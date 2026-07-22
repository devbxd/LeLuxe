const { chromium } = require("playwright");


const EXTRA_CATEGORIES = [
    "https://www.veja-store.com/fr_fr/homme-campo",
    "https://www.veja-store.com/fr_fr/homme-v-90",
    "https://www.veja-store.com/fr_fr/homme-gt",
    "https://www.veja-store.com/fr_fr/homme-cateyes",
    "https://www.veja-store.com/fr_fr/homme-rio-branco",
    "https://www.veja-store.com/fr_fr/homme-belem",
    "https://www.veja-store.com/fr_fr/homme-volley",
    "https://www.veja-store.com/fr_fr/homme-v-10",
    "https://www.veja-store.com/fr_fr/homme-esplar",
    "https://www.veja-store.com/fr_fr/homme-panenka",
    "https://www.veja-store.com/fr_fr/homme-jitsu",
    "https://www.veja-store.com/fr_fr/homme-arpoador",
    "https://www.veja-store.com/fr_fr/homme-etna",
    "https://www.veja-store.com/fr_fr/homme-v-12",
    "https://www.veja-store.com/fr_fr/homme-urca",
    "https://www.veja-store.com/fr_fr/homme-condor-3-advanced",
    "https://www.veja-store.com/fr_fr/homme-recife",
    "https://www.veja-store.com/fr_fr/homme-v-82",
    "https://www.veja-store.com/fr_fr/homme-salar",
    "https://www.veja-store.com/fr_fr/homme-venturi",
    "https://www.veja-store.com/fr_fr/homme-retro-running",
    "https://www.veja-store.com/fr_fr/femme",
    "https://www.veja-store.com/fr_fr/femme-gt",
    "https://www.veja-store.com/fr_fr/femme-campo",
    "https://www.veja-store.com/fr_fr/femme-best-sellers",
    "https://www.veja-store.com/fr_fr/enfant",
    "https://www.veja-store.com/fr_fr/sandales"
];


async function scrapeOneCategory(page, url, collected){

    await page.goto(url,{
        waitUntil:"domcontentloaded",
        timeout:60000
    });

    await page.waitForTimeout(5000);

    let stable=0, last=0;

    for(let i=0;i<40 && stable<5;i++){

        await page.mouse.wheel(0,1200);

        await page.waitForTimeout(600);

        const c = await page.evaluate(()=>document.querySelectorAll("[data-pid]").length);

        if(c===last) stable++; else stable=0;

        last=c;

    }

    const products = await page.evaluate(()=>{

        let data=[];

        document.querySelectorAll("[data-pid]").forEach(tile=>{

            let img = tile.querySelector("img");
            if(!img) return;

            let name = img.alt || "";
            if(!name) return;
            // l'alt contient souvent "... <ref sku> Lateral view" : on nettoie
            name = name.replace(/\s*[a-z]{2}\d{7,}\s*/i, ' ').replace(/\s*(lateral|front|top|back|side)\s*view\s*$/i, '').replace(/\s+/g,' ').trim();
            name = name.charAt(0).toUpperCase() + name.slice(1);

            let priceEl = tile.querySelector("[class*='price']");
            let price = priceEl ? priceEl.innerText.trim() : "Prix inconnu";

            let a = tile.closest("a") || tile.querySelector("a");
            let link = a ? a.href : "";

            let image = img.currentSrc || img.src || "";
            if(!image) return;

            data.push({ name, price, image, url:link });

        });

        return data;

    });

    products.forEach(p=>{ let key = p.url || p.image; if(key) collected.set(key, p); });

}


async function scrapeVeja(url, brand, category){


    const browser = await chromium.launch({
        headless:false
    });


    try{


        console.log("Ouverture Veja...");

        const collected = new Map();

        for(const catUrl of [url, ...EXTRA_CATEGORIES]){

            if(collected.size >= 300) break;

            const before = collected.size;

            const page = await browser.newPage({ viewport:{ width:1440, height:900 } });

            try{
                await scrapeOneCategory(page, catUrl, collected);
                console.log(catUrl, "->", collected.size-before, "tuiles (total", collected.size, ")");
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


module.exports = scrapeVeja;
