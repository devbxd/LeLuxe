const { chromium } = require("playwright");


function parseTile(text){

    let lines = text
        .split("\n")
        .map(x=>x.trim())
        .filter(Boolean);

    let priceRegex = /(\d[\d.,]*\s*€|€\s*[\d.,]+)/;

    let priceIndex = lines.findIndex(l=>priceRegex.test(l));

    let price = priceIndex>=0 ? lines[priceIndex] : "Prix inconnu";

    let banned = /^(previous|next|soldes|nouveau|new|nouveautés?|voir tout|avis|ignorer.*|prix réduit de|à|\+\d+|-?\d+%)$/i;

    let candidates = lines.filter((l,i)=>
        i!==priceIndex &&
        l.length>2 &&
        !banned.test(l) &&
        !priceRegex.test(l)
    );

    let name = candidates.sort((a,b)=>b.length-a.length)[0] || lines[0] || "Produit";

    return { name, price };

}


async function scrapeHugoBoss(url, brand, category){


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


        console.log("Ouverture Hugo Boss...");


        await page.goto(url,{
            waitUntil:"domcontentloaded",
            timeout:60000
        });


        await page.waitForTimeout(8000);


        let stable=0, last=0;

        for(let i=0;i<40 && stable<8;i++){

            await page.mouse.wheel(0,1200);

            await page.waitForTimeout(700);

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


module.exports = scrapeHugoBoss;
