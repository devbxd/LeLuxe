const { chromium } = require("playwright");


async function scrapeArmaniExchange(url, brand, category){


    const browser = await chromium.launch({
        headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox','--blink-settings=imagesEnabled=false']
    });


    const page = await browser.newPage({
        viewport:{
            width:1440,
            height:900
        }
    });


    try{


        console.log("Ouverture Armani Exchange...");


        await page.goto(url,{
            waitUntil:"domcontentloaded",
            timeout:60000
        });


        await page.waitForTimeout(5000);


        let stable=0, last=0;

        for(let i=0;i<40 && stable<5;i++){

            await page.mouse.wheel(0,1200);

            await page.waitForTimeout(600);

            const c = await page.evaluate(()=>document.querySelectorAll("[data-testid='link-to-product']").length);

            if(c===last) stable++; else stable=0;

            last=c;

        }


        function extract(){


            let data=[];


            document.querySelectorAll("[data-testid='link-to-product']").forEach(link=>{


                let name = (link.innerText || "").trim();

                if(!name) return;


                let card = link;

                for(let i=0;i<4 && card;i++) card = card.parentElement;

                if(!card) return;


                let img = card.querySelector("img");

                let image = img ? (img.currentSrc || img.src) : "";

                if(!image) return;


                // en promo : le prix final est dans un <span> (2e span après le prix barré)
                // prix plein : pas de <span>, le prix est dans un <div> à la place
                let priceEls = Array.from(card.querySelectorAll("span, div"))
                    .filter(s=>/€/.test(s.innerText) && s.children.length===0);

                let price = priceEls.length
                    ? priceEls[priceEls.length-1].innerText.trim()
                    : "Prix inconnu";


                data.push({ name, price, image, url:link.href });


            });


            return data;


        }


        const collected = new Map();

        (await page.evaluate(extract)).forEach(p=>{ if(p.url) collected.set(p.url, p); });


        // pagination simple via ?page=N
        for(let p=2; p<=20 && collected.size<300; p++){

            const sep = url.includes("?") ? "&" : "?";

            await page.goto(`${url}${sep}page=${p}`,{
                waitUntil:"domcontentloaded",
                timeout:60000
            });

            await page.waitForTimeout(2500);

            const batch = await page.evaluate(extract);

            if(batch.length===0) break;

            batch.forEach(item=>{ if(item.url) collected.set(item.url, item); });

        }


        const capped = Array.from(collected.values()).slice(0,300);


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


module.exports = scrapeArmaniExchange;
