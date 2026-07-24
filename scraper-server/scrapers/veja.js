const { chromium } = require("playwright");
const { setCollectedItem } = require("./_shared");


// Chaque URL de catégorie est étiquetée homme/femme pour que les articles
// héritent du bon genre (le site ne l'expose pas au niveau de la tuile).
// Listes équilibrées et intercalées pour ne pas laisser un genre en dernier
// si un plafond venait à interrompre le scraping.
const EXTRA_CATEGORIES = [
    ["https://www.veja-store.com/fr_fr/homme-campo", "homme"],
    ["https://www.veja-store.com/fr_fr/femme-campo", "femme"],
    ["https://www.veja-store.com/fr_fr/homme-v-90", "homme"],
    ["https://www.veja-store.com/fr_fr/femme", "femme"],
    ["https://www.veja-store.com/fr_fr/homme-gt", "homme"],
    ["https://www.veja-store.com/fr_fr/femme-gt", "femme"],
    ["https://www.veja-store.com/fr_fr/homme-cateyes", "homme"],
    ["https://www.veja-store.com/fr_fr/femme-best-sellers", "femme"],
    ["https://www.veja-store.com/fr_fr/homme-rio-branco", "homme"],
    ["https://www.veja-store.com/fr_fr/homme-belem", "homme"],
    ["https://www.veja-store.com/fr_fr/homme-volley", "homme"],
    ["https://www.veja-store.com/fr_fr/homme-v-10", "homme"],
    ["https://www.veja-store.com/fr_fr/homme-esplar", "homme"],
    ["https://www.veja-store.com/fr_fr/homme-panenka", "homme"],
    ["https://www.veja-store.com/fr_fr/homme-jitsu", "homme"],
    ["https://www.veja-store.com/fr_fr/homme-arpoador", "homme"],
    ["https://www.veja-store.com/fr_fr/homme-etna", "homme"],
    ["https://www.veja-store.com/fr_fr/homme-v-12", "homme"],
    ["https://www.veja-store.com/fr_fr/homme-urca", "homme"],
    ["https://www.veja-store.com/fr_fr/homme-condor-3-advanced", "homme"],
    ["https://www.veja-store.com/fr_fr/homme-recife", "homme"],
    ["https://www.veja-store.com/fr_fr/homme-v-82", "homme"],
    ["https://www.veja-store.com/fr_fr/homme-salar", "homme"],
    ["https://www.veja-store.com/fr_fr/homme-venturi", "homme"],
    ["https://www.veja-store.com/fr_fr/homme-retro-running", "homme"],
    ["https://www.veja-store.com/fr_fr/sandales", null]
];


async function scrapeOneCategory(page, url, gender, collected){

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

    products.forEach(p=>{ let key = p.url || p.image; if(key) setCollectedItem(collected, key, {...p, gender}); });

}


async function scrapeVeja(url, brand, category){


    const browser = await chromium.launch({
        headless:false
    });


    try{


        console.log("Ouverture Veja...");

        const collected = new Map();

        for(const [catUrl, gender] of EXTRA_CATEGORIES){

            const before = collected.size;

            const page = await browser.newPage({ viewport:{ width:1440, height:900 } });

            try{
                await scrapeOneCategory(page, catUrl, gender, collected);
                console.log(catUrl, "->", collected.size-before, "tuiles (total", collected.size, ")");
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


module.exports = scrapeVeja;
