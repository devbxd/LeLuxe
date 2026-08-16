const { chromium } = require("playwright");


const EXTRA_CATEGORIES = [
    "https://fr.maje.com/fr/pret-a-porter/collection/toute-la-collection/",
    "https://fr.maje.com/fr/pret-a-porter/collection/tops-et-chemises/",
    "https://fr.maje.com/fr/pret-a-porter/collection/vestes-et-blousons/",
    "https://fr.maje.com/fr/pret-a-porter/collection/jupes-et-shorts/",
    "https://fr.maje.com/fr/pret-a-porter/collection/pantalons-et-jeans/",
    "https://fr.maje.com/fr/pret-a-porter/collection/pulls-et-cardigans/",
    "https://fr.maje.com/fr/pret-a-porter/collection/manteaux/",
    "https://fr.maje.com/fr/sacs/collection/tous-les-sacs/",
    "https://fr.maje.com/fr/accessoires/collection/tous-les-accessoires/",
    "https://fr.maje.com/fr/accessoires/collection/bijoux/",
    "https://fr.maje.com/fr/accessoires/collection/lunettes-de-soleil/",
    "https://fr.maje.com/fr/accessoires/chaussures/toutes-les-chaussures/"
];


async function scrapeOneCategory(page, url, collected){

    await page.goto(url,{
        waitUntil:"domcontentloaded",
        timeout:60000
    });

    await page.waitForTimeout(5000);

    let majeStable=0, majeLast=0;

    for(let i=0;i<40 && majeStable<5;i++){

        await page.mouse.wheel(0,1200);

        await page.waitForTimeout(600);

        const c = await page.evaluate(()=>document.querySelectorAll("[data-pid]").length);

        if(c===majeLast) majeStable++; else majeStable=0;

        majeLast=c;

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
                url: link
            });

        });

        return data;

    });

    products.forEach(p=>{ let key = p.url || p.image; if(key) collected.set(key, p); });

}


async function scrapeMaje(url, brand, category){


    const browser = await chromium.launch({
        headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox']
    });


    try{


        console.log("Ouverture Maje...");

        const collected = new Map();

        for(const catUrl of [url, ...EXTRA_CATEGORIES]){

            if(collected.size >= 600) break;

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

        const capped = Array.from(collected.values()).slice(0,600);


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


module.exports = scrapeMaje;
