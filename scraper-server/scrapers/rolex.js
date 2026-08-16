const { chromium } = require("playwright");


const FAMILY_PAGES = [
    "https://www.rolex.com/fr/watches/yacht-master",
    "https://www.rolex.com/fr/watches/land-dweller",
    "https://www.rolex.com/fr/watches/day-date",
    "https://www.rolex.com/fr/watches/sky-dweller",
    "https://www.rolex.com/fr/watches/lady-datejust",
    "https://www.rolex.com/fr/watches/datejust",
    "https://www.rolex.com/fr/watches/oyster-perpetual",
    "https://www.rolex.com/fr/watches/cosmograph-daytona",
    "https://www.rolex.com/fr/watches/submariner",
    "https://www.rolex.com/fr/watches/sea-dweller",
    "https://www.rolex.com/fr/watches/deepsea",
    "https://www.rolex.com/fr/watches/gmt-master-ii",
    "https://www.rolex.com/fr/watches/yacht-master-ii",
    "https://www.rolex.com/fr/watches/explorer",
    "https://www.rolex.com/fr/watches/explorer-ii",
    "https://www.rolex.com/fr/watches/air-king",
    "https://www.rolex.com/fr/watches/1908"
];


async function scrapeOneFamily(page, url){

    await page.goto(url,{
        waitUntil:"domcontentloaded",
        timeout:60000
    });

    await page.waitForTimeout(4000);

    for(let i=0;i<6;i++){

        await page.mouse.wheel(0,900);

        await page.waitForTimeout(600);

    }

    return await page.evaluate(()=>{

        let data=[];

        document.querySelectorAll("a[href*='/watches/']").forEach(a=>{

            let img = a.querySelector("img");

            if(!img) return;

            let name = (a.innerText || a.getAttribute("aria-label") || "").trim();

            if(!name) return;

            let image = img.currentSrc || img.src || "";

            if(!image) return;

            data.push({ name, image, url:a.href });

        });

        return data;

    });

}


async function scrapeRolex(url, brand, category){


    const browser = await chromium.launch({
        headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox']
    });


    try{


        console.log("Ouverture Rolex...");


        let allRaw = [];

        for(const famUrl of [url, ...FAMILY_PAGES]){

            if(allRaw.length >= 600) break;

            const page = await browser.newPage({ viewport:{ width:1440, height:900 } });

            try{

                const raw = await scrapeOneFamily(page, famUrl);

                allRaw.push(...raw);

                console.log(famUrl, "->", raw.length, "montres");

            }catch(e){

                console.log("Erreur sur", famUrl, ":", e.message);

            }finally{

                await page.close();

            }

        }


        const seen = new Set();

        const withPrice = [];

        allRaw.forEach(p=>{

            if(seen.has(p.url)) return;

            seen.add(p.url);

            withPrice.push({

                name: p.name,

                price: "Voir sur rolex.com",

                image: p.image,

                url: p.url

            });

        });


        const capped = withPrice.slice(0,600);


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


module.exports = scrapeRolex;
