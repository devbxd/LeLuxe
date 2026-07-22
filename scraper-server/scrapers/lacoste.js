const { chromium } = require("playwright");


async function scrapeLacoste(url, brand, category){


    const browser = await chromium.launch({
        headless:false
    });


    const page = await browser.newPage({

        viewport:{
            width:1440,
            height:900
        }

    });


    try{


        console.log("Ouverture page...");


        await page.goto(url,{
            waitUntil:"domcontentloaded",
            timeout:60000
        });


        console.log("Page ouverte");


        // attendre les produits
        await page.waitForTimeout(5000);


        // scroll pour charger plus de produits
        for(let i=0;i<8;i++){

            await page.mouse.wheel(0,900);

            await page.waitForTimeout(1200);

        }


        // clique "produits suivants" jusqu'à 300 produits max
        for(let i=0;i<10;i++){

            let count = await page.evaluate(()=>document.querySelectorAll("[data-pid]").length);

            if(count >= 300) break;

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


        console.log("Extraction écran...");



        const products = await page.evaluate(()=>{


            let data=[];


            // chaque produit est une tuile SFCC avec un attribut data-pid
            document.querySelectorAll("[data-pid]").forEach(tile=>{


                let nameEl = tile.querySelector(".js-product-tile-title");

                let name = nameEl ? nameEl.innerText.trim() : "";

                if(!name) return;


                let priceEl =
                    tile.querySelector(".sales-price") ||
                    tile.querySelector("[class*='price']");

                let price = priceEl ? priceEl.innerText.trim().split("\n")[0] : "Prix inconnu";


                let link =
                    tile.querySelector("a.product-tile-link")?.href ||
                    tile.querySelector("a")?.href ||
                    "";


                let img =
                    tile.querySelector("img[src*='impolicy=pctp']") ||
                    tile.querySelector("img");

                let image = img ? (img.currentSrc || img.src) : "";

                // demande une image plus grande que la vignette par défaut
                if(image) image = image.replace(/imwidth=\d+/, "imwidth=600");


                if(!image) return;


                data.push({

                    name,

                    price,

                    image,

                    url:link

                });


            });



            // supprimer doublons

            let result=[];

            let seen=new Set();



            data.forEach(product=>{


                let key =
                product.url || product.image;



                if(!seen.has(key)){


                    seen.add(key);

                    result.push(product);


                }



            });



            return result;


        });



        const capped = products.slice(0,300);


        console.log(
            "PRODUITS TROUVES:",
            capped.length
        );



        return capped;



    }catch(error){


        console.log(
            "Erreur scraping:",
            error.message
        );


        return [];


    }
    finally{


        await browser.close();


    }



}



module.exports = scrapeLacoste;
