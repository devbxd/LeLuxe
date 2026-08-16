const { chromium } = require("playwright");


const EXTRA_CATEGORIES = [
    "https://www.bottegaveneta.com/fr-fr/men/bags.html",
    "https://www.bottegaveneta.com/fr-fr/men/shoes.html",
    "https://www.bottegaveneta.com/fr-fr/women.html",
    "https://www.bottegaveneta.com/fr-fr/women/bags.html",
    "https://www.bottegaveneta.com/fr-fr/women/shoes.html"
];


function parseTile(text){

    let lines = text
        .split("\n")
        .map(x=>x.trim())
        .filter(Boolean);

    let priceRegex = /(\d[\d.,]*\s*€|€\s*[\d.,]+)/;

    let priceIndex = lines.findIndex(l=>priceRegex.test(l));

    let price = priceIndex>=0 ? lines[priceIndex] : "Prix inconnu";

    let banned = /^(previous|next|soldes|nouveau|new|nouveautés?|voir tout|acheter le look|avis|ignorer.*|prix réduit de|à|\+\d+|-?\d+%)$/i;

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
        waitUntil:"networkidle",
        timeout:60000
    });

    await page.waitForTimeout(8000);

    let stable=0, last=0;

    for(let i=0;i<40 && stable<8;i++){

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

            let text = tile.innerText || "";
            if(!/€/.test(text)) return;

            let a = tile.closest("a") || tile.querySelector("a");
            let link = a ? a.href : "";

            let image = img.getAttribute("data-src") || img.currentSrc || img.getAttribute("src") || "";
            if(!image) return;

            data.push({ text, image, url:link });

        });

        return data;

    });

    products.forEach(p=>{ let key = p.url || p.image; if(key) collected.set(key, p); });

}


async function scrapeBottegaVeneta(url, brand, category){


    const browser = await chromium.launch({
        headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox','--blink-settings=imagesEnabled=false']
    });


    try{


        console.log("Ouverture Bottega Veneta...");

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


        const withNames = Array.from(collected.values()).map(p=>{

            let { name, price } = parseTile(p.text);

            return { name, price, image:p.image, url:p.url };

        }).slice(0,300);


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


module.exports = scrapeBottegaVeneta;
