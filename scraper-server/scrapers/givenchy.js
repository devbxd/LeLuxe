const { chromium } = require("playwright");


function parseTile(text){

    let lines = text
        .split("\n")
        .map(x=>x.trim())
        .filter(Boolean);

    let name = lines[0] || "Produit Givenchy";

    let price = lines.find(x=>/€/.test(x)) || "Prix inconnu";

    return { name, price };

}


const EXTRA_CATEGORIES = [
    "https://www.givenchy.com/fr/fr/homme/chaussures/",
    "https://www.givenchy.com/fr/fr/homme/sacs/",
    "https://www.givenchy.com/fr/fr/homme/accessoires/",
    "https://www.givenchy.com/fr/fr/femme",
    "https://www.givenchy.com/fr/fr/femme/chaussures/",
    "https://www.givenchy.com/fr/fr/femme/sacs/",
    "https://www.givenchy.com/fr/fr/femme/accessoires/"
];


async function scrapeOneCategory(page, url){

    await page.goto(url,{
        waitUntil:"domcontentloaded",
        timeout:60000
    });

    await page.waitForTimeout(5000);

    for(let i=0;i<6;i++){

        await page.mouse.wheel(0,900);

        await page.waitForTimeout(800);

    }

    for(let i=0;i<10;i++){

        let clicked = await page.evaluate(()=>{
            let btn = document.querySelector(".js-plp-next-btn, a[rel='next'], .js-fetch-append-btn");
            if(!btn) return false;
            btn.scrollIntoView();
            btn.click();
            return true;
        });

        if(!clicked) break;

        await page.waitForTimeout(2200);

    }

    return await page.evaluate(()=>{

        let data=[];

        document.querySelectorAll(".product-tile").forEach(tile=>{

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


async function scrapeGivenchy(url, brand, category){


    const browser = await chromium.launch({
        headless:false
    });


    try{


        console.log("Ouverture Givenchy...");


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


module.exports = scrapeGivenchy;
