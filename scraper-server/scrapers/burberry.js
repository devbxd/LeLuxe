const { chromium } = require("playwright");


const EXTRA_CATEGORIES = [
    "https://fr.burberry.com/l/mens-clothing/knitwear/",
    "https://fr.burberry.com/l/mens-clothing/polos-t-shirts/",
    "https://fr.burberry.com/l/mens-clothing/shirts/",
    "https://fr.burberry.com/l/mens-coats-jackets/",
    "https://fr.burberry.com/l/mens-shoes/",
    "https://fr.burberry.com/l/mens-bags/",
    "https://fr.burberry.com/l/mens-accessories/",
    "https://fr.burberry.com/l/womens-clothing/",
    "https://fr.burberry.com/l/womens-shoes/",
    "https://fr.burberry.com/l/womens-bags/",
    "https://fr.burberry.com/l/womens-accessories/"
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


async function scrapeOneCategory(page, url){

    await page.goto(url,{
        waitUntil:"domcontentloaded",
        timeout:60000
    });

    await page.waitForTimeout(5000);

    for(let i=0;i<8;i++){

        await page.mouse.wheel(0,900);

        await page.waitForTimeout(800);

    }

    return await page.evaluate(()=>{

        let data=[];

        document.querySelectorAll("li[class*='product']").forEach(tile=>{

            let img = tile.querySelector("[class*='media-carousel'] img") || tile.querySelector("img:not([class*='swatch'])") || tile.querySelector("img");

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


async function scrapeBurberry(url, brand, category){


    const browser = await chromium.launch({
        headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox']
    });


    try{


        console.log("Ouverture Burberry...");


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


module.exports = scrapeBurberry;
