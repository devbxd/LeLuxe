const { chromium } = require("playwright");


function parseTile(text){

    let lines = text
        .split("\n")
        .map(x=>x.trim())
        .filter(Boolean);

    let priceRegex = /(\d[\d.,]*\s*€|€\s*[\d.,]+)/;

    let priceIndex = lines.findIndex(l=>priceRegex.test(l));

    let price = priceIndex>=0 ? lines[priceIndex] : "Prix inconnu";

    let banned = /^(previous|next|soldes|nouveau|new|nouveautés?|voir tout|d[ée]couvrir|avis|ignorer.*|prix réduit de|à|\+\d+|-?\d+%|\d+\s*(ml|g|avis))$/i;

    let candidates = lines.filter((l,i)=>
        i!==priceIndex &&
        l.length>2 &&
        !banned.test(l) &&
        !priceRegex.test(l)
    );

    let name = candidates.sort((a,b)=>b.length-a.length)[0] || lines[0] || "Produit";

    return { name, price };

}


async function scrapeSephora(url, brand, category){


    const browser = await chromium.launch({
        headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox']
    });


    const page = await browser.newPage({
        viewport:{
            width:1440,
            height:900
        }
    });


    try{


        console.log("Ouverture Sephora...");


        await page.goto(url,{
            waitUntil:"domcontentloaded",
            timeout:60000
        });


        await page.waitForTimeout(5000);


        for(let i=0;i<8;i++){

            await page.mouse.wheel(0,900);

            await page.waitForTimeout(800);

        }


        const products = await page.evaluate(()=>{


            let data=[];


            document.querySelectorAll("[data-testid*='product']").forEach(tile=>{


                let img = tile.querySelector("img");

                if(!img) return;


                let text = tile.innerText || "";

                if(!text.trim()) return;


                let a = tile.closest("a") || tile.querySelector("a");

                let link = a ? a.href : "";


                let image = img.currentSrc || img.src || "";


                data.push({ text, image, url:link });


            });


            let result=[];

            let seen=new Set();

            data.forEach(p=>{

                let key = p.url || p.image;

                if(!seen.has(key)){
                    seen.add(key);
                    result.push(p);
                }

            });


            return result;


        });


        const withNames = products.map(p=>{

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


module.exports = scrapeSephora;
