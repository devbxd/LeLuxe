const { chromium } = require("playwright");


const EXTRA_CATEGORIES = [
    "https://www.versace.com/fr/fr/homme/vetements/chemises/",
    "https://www.versace.com/fr/fr/homme/vetements/vestes-et-manteaux/",
    "https://www.versace.com/fr/fr/homme/vetements/maille/",
    "https://www.versace.com/fr/fr/homme/vetements/t-shirts-et-polos/",
    "https://www.versace.com/fr/fr/homme/vetements/sweats/",
    "https://www.versace.com/fr/fr/homme/vetements/pantalons-et-shorts/",
    "https://www.versace.com/fr/fr/homme/vetements/denim/",
    "https://www.versace.com/fr/fr/homme/chaussures/",
    "https://www.versace.com/fr/fr/homme/sacs/",
    "https://www.versace.com/fr/fr/homme/accessoires/",
    "https://www.versace.com/fr/fr/femme/vetements/",
    "https://www.versace.com/fr/fr/femme/chaussures/",
    "https://www.versace.com/fr/fr/femme/sacs/",
    "https://www.versace.com/fr/fr/femme/accessoires/"
];


function parseTile(text){

    let lines = text
        .split("\n")
        .map(x=>x.trim())
        .filter(Boolean);

    let name = lines[0] || "Produit Versace";

    let price = lines.find(x=>/€/.test(x)) || "Prix inconnu";

    return { name, price };

}


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
            let btn = document.querySelector(".desktop-load-more, .js-plp-next-btn, a[rel='next'], .js-fetch-append-btn");
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

        document.querySelectorAll("[data-pid]").forEach(tile=>{

            let img = tile.querySelector(".b-product_tile-image") || tile.querySelector("img");

            if(!img) return;

            let text = tile.innerText || "";

            if(!text.trim()) return;

            let a = tile.closest("a") || tile.querySelector("a");

            let link = a ? a.href : "";

            let image = img.getAttribute("data-original-src") || img.currentSrc || img.src || "";

            if(!image || /default-fallback/.test(image)) return;

            data.push({ text, image, url:link });

        });

        return data;

    });

}


async function scrapeVersace(url, brand, category){


    const browser = await chromium.launch({
        headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox']
    });


    try{


        console.log("Ouverture Versace...");


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

            let { name, price } = parseTile(p.text);

            withNames.push({ name, price, image:p.image, url:p.url });

        });


        const capped = withNames.slice(0,600);


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


module.exports = scrapeVersace;
