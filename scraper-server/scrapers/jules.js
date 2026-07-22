const { chromium } = require("playwright");


const EXTRA_CATEGORIES = [
    "https://www.jules.com/fr-fr/l/t-shirt/",
    "https://www.jules.com/fr-fr/l/pull/",
    "https://www.jules.com/fr-fr/l/jeans/",
    "https://www.jules.com/fr-fr/l/chemise/",
    "https://www.jules.com/fr-fr/l/pantalon/",
    "https://www.jules.com/fr-fr/l/veste-blouson/",
    "https://www.jules.com/fr-fr/l/pull-soldes/",
    "https://www.jules.com/fr-fr/l/accessoires/",
    "https://www.jules.com/fr-fr/l/chaussures/",
    "https://www.jules.com/fr-fr/l/polo/"
];


async function scrapeOneCategory(page, url){

    await page.goto(url,{
        waitUntil:"domcontentloaded",
        timeout:60000
    });

    await page.waitForTimeout(5000);

    let stable=0, last=0;

    for(let i=0;i<40 && stable<5;i++){

        await page.mouse.wheel(0,1300);

        await page.waitForTimeout(600);

        const c = await page.evaluate(()=>document.querySelectorAll("[data-pid]").length);

        if(c===last) stable++; else stable=0;

        last=c;

    }

    return await page.evaluate(()=>{

        let data=[];

        document.querySelectorAll("[data-pid]").forEach(tile=>{

            let img = Array.from(tile.querySelectorAll("img")).find(i=>{
                let s = i.getAttribute("data-frz-src") || i.currentSrc || i.src || "";
                return s && !/flag|badge|icon|logo|\/marketing\//i.test(s);
            });

            if(!img) return;

            let image = img.getAttribute("data-frz-src") || img.currentSrc || img.src || "";

            if(!image || /^data:/.test(image)) return;

            // nom et prix réels : éléments dédiés, pas le texte brut de la tuile
            // (celui-ci mélange parfois les libellés d'accessibilité "Image
            // précédente/suivante/Achat rapide" sur une seule ligne)
            let nameEl = tile.querySelector(".pdp-title-link, .pdp-link");

            let name = nameEl ? nameEl.innerText.trim() : "";

            if(!name) return;


            let priceEl = tile.querySelector(".price");

            let price = priceEl ? priceEl.innerText.trim().split("\n")[0] : "Prix inconnu";


            let a = tile.closest("a") || tile.querySelector("a");

            let link = a ? a.href : "";

            data.push({ name, price, image, url:link });

        });

        return data;

    });

}


async function scrapeJules(url, brand, category){


    const browser = await chromium.launch({
        headless:false
    });


    try{


        console.log("Ouverture Jules...");


        let allRaw = [];

        for(const catUrl of [url, ...EXTRA_CATEGORIES]){

            if(allRaw.length >= 600) break;

            const page = await browser.newPage({ viewport:{ width:1440, height:900 } });

            try{

                const raw = await scrapeOneCategory(page, catUrl);

                allRaw.push(...raw);

                console.log(catUrl, "->", raw.length, "tuiles");

            }catch(e){

                console.log("Erreur sur", catUrl, ":", e.message);

            }finally{

                await page.close();

            }

        }


        const withNames = [];

        const seen = new Set();

        allRaw.forEach(p=>{

            let key = p.url || p.image;

            if(seen.has(key)) return;

            seen.add(key);

            withNames.push(p);

        });


        const capped = withNames.slice(0,300);


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


module.exports = scrapeJules;
