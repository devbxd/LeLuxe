const { chromium } = require("playwright");


const EXTRA_CATEGORIES = [
    "https://www.lahalle.com/femme",
    "https://www.lahalle.com/chaussures-homme",
    "https://www.lahalle.com/chaussures-femme-cf_030000",
    "https://www.lahalle.com/accessoires-homme-ch_030000",
    "https://www.lahalle.com/accessoires-femme-cf_060000",
    "https://www.lahalle.com/bebe"
];


function parseTile(text){

    let lines = text
        .split("\n")
        .map(x=>x.trim())
        .filter(Boolean);

    let priceRegex = /(\d[\d.,]*\s*€|€\s*[\d.,]+)/;

    let priceIndex = lines.findIndex(l=>priceRegex.test(l));

    let price = priceIndex>=0 ? lines[priceIndex] : "Prix inconnu";

    let banned = /^(previous|next|soldes|nouveau|new|nouveautés?|voir tout|découvrir|avis|ignorer.*|prix réduit de|à|\+\d+|-?\d+%)$/i;

    let candidates = lines.filter((l,i)=>
        i!==priceIndex &&
        l.length>2 &&
        !banned.test(l) &&
        !priceRegex.test(l)
    );

    let name = candidates.sort((a,b)=>b.length-a.length)[0] || lines[0] || "Produit";

    return { name, price };

}


async function scrapeOneCategory(page, url, collected){

    await page.goto(url,{
        waitUntil:"domcontentloaded",
        timeout:60000
    });

    await page.waitForTimeout(5000);

    let lahalleStable=0, lahalleLast=0;

    for(let i=0;i<50 && lahalleStable<5;i++){

        await page.mouse.wheel(0,1300);

        await page.waitForTimeout(600);

        const c = await page.evaluate(()=>document.querySelectorAll("[data-pid]").length);

        if(c===lahalleLast) lahalleStable++; else lahalleStable=0;

        lahalleLast=c;

    }

    const products = await page.evaluate(()=>{

        let data=[];

        document.querySelectorAll("[data-pid]").forEach(tile=>{

            let img = tile.querySelector("img");
            if(!img) return;

            let text = tile.innerText || "";
            if(!text.trim()) return;

            let a = tile.closest("a") || tile.querySelector("a");
            let link = a ? a.href : "";

            let image = img.currentSrc || img.src || "";

            data.push({ text, image, url:link });

        });

        return data;

    });

    products.forEach(p=>{ let key = p.url || p.image; if(key) collected.set(key, p); });

}


async function scrapeLaHalle(url, brand, category){


    const browser = await chromium.launch({
        headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox']
    });


    try{


        console.log("Ouverture La Halle...");

        const collected = new Map();

        // une page fraîche par catégorie : en réutilisant la même page,
        // le widget de grille de La Halle reste bloqué à 0 produit après
        // une navigation interne (probablement un routage SPA qui ne
        // réinitialise pas complètement le composant de listing)
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

        const withNames = Array.from(collected.values()).map(p=>{

            let { name, price } = parseTile(p.text);

            return { name, price, image:p.image, url:p.url };

        }).slice(0,600);


        console.log("PRODUITS TROUVES:", withNames.length);


        return withNames;


    }catch(error){


        console.log("Erreur scraping:", error.message);

        return [];


    }
    finally{

        await browser.close();

    }


}


module.exports = scrapeLaHalle;
