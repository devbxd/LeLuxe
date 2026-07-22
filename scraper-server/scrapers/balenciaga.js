const { chromium } = require("playwright");


const EXTRA_CATEGORIES = [
    "https://www.balenciaga.com/fr-fr/men/bags",
    "https://www.balenciaga.com/fr-fr/homme/chaussures-pour-homme/voir-tout",
    "https://www.balenciaga.com/fr-fr/homme/petite-maroquinerie-pour-homme/voir-tout",
    "https://www.balenciaga.com/fr-fr/femme/pret-a-porter-pour-femme/voir-tout",
    "https://www.balenciaga.com/fr-fr/femme/sacs-pour-femme/voir-tout",
    "https://www.balenciaga.com/fr-fr/femme/chaussures-pour-femme/voir-tout",
    "https://www.balenciaga.com/fr-fr/femme/accessoires-pour-femme/voir-tout",
    "https://www.balenciaga.com/fr-fr/femme/petite-maroquinerie/voir-tout"
];


function parseTile(text){

    let lines = text
        .split("\n")
        .map(x=>x.trim())
        .filter(Boolean);

    let name = lines[0] || "Produit Balenciaga";

    let price = lines.find(x=>/€/.test(x)) || "Prix inconnu";

    return { name, price };

}


async function scrapeOneCategory(page, url){

    await page.goto(url,{
        waitUntil:"domcontentloaded",
        timeout:60000
    });

    await page.waitForTimeout(5000);

    // Balenciaga charge en scroll infini : les liens de pagination numérotée
    // déclenchent une vraie navigation (et redirigent parfois vers une tout
    // autre catégorie), donc on ne clique pas dessus, on scrolle simplement
    // jusqu'à stabilisation.
    let stable=0, last=0;

    for(let i=0;i<60 && (stable<10 || i<8);i++){

        await page.mouse.wheel(0,1200);

        await page.waitForTimeout(700);

        const c = await page.evaluate(()=>document.querySelectorAll("[data-pid]").length);

        if(c===last) stable++; else stable=0;

        last=c;

    }

    return await page.evaluate(()=>{

        let data=[];

        document.querySelectorAll("[data-pid]").forEach(tile=>{

            let img = tile.querySelector("img");

            if(!img) return;

            let text = tile.innerText || "";

            if(!text.trim()) return;

            let a = tile.closest("a") || tile.querySelector("a");

            let link = a ? a.href : "";

            let image = img.currentSrc || img.src || "";

            if(!image) return;

            data.push({ text, image, url:link });

        });

        return data;

    });

}


async function scrapeBalenciaga(url, brand, category){


    const browser = await chromium.launch({
        headless:false
    });


    try{


        console.log("Ouverture Balenciaga...");


        let allRaw = [];

        for(const catUrl of [url, ...EXTRA_CATEGORIES]){

            if(allRaw.length >= 300) break;

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

            let { name, price } = parseTile(p.text);

            withNames.push({ name, price, image:p.image, url:p.url });

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


module.exports = scrapeBalenciaga;
