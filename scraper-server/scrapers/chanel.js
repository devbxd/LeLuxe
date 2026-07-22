const { chromium, devices } = require("playwright");


const EXTRA_CATEGORIES = [
    "https://www.chanel.com/fr/mode/sacs-et-petite-maroquinerie/",
    "https://www.chanel.com/fr/mode/chaussures/",
    "https://www.chanel.com/fr/mode/accessoires/"
];


// Chanel bloque (403 Akamai) toute navigation vers les fiches produit en
// mode desktop, mais PAS en émulation mobile (iPhone) — c'est ce qui
// permet enfin de récupérer le vrai prix depuis le JSON-LD de la fiche.
function nameFromSlug(url){

    try{

        const u = new URL(url);

        const parts = u.pathname.split("/").filter(Boolean);

        const slug = parts[parts.length-1] || parts[parts.length-2] || "";

        return slug
            .replace(/-/g," ")
            .replace(/\b\w/g, c=>c.toUpperCase()) || "Produit Chanel";

    }catch(e){

        return "Produit Chanel";

    }

}


async function scrapeOneListing(browser, url, collected){

    const context = await browser.newContext({
        ...devices["iPhone 13"],
        locale:"fr-FR"
    });

    const page = await context.newPage();

    try{

        await page.goto(url,{
            waitUntil:"domcontentloaded",
            timeout:120000
        });

        await page.waitForTimeout(6000);

        let chanelStable=0, chanelLast=0;

        for(let i=0;i<40 && chanelStable<5;i++){

            await page.mouse.wheel(0,1400);

            await page.waitForTimeout(700);

            const c = await page.evaluate(()=>document.querySelectorAll("a[href*='/p/']").length);

            if(c===chanelLast) chanelStable++; else chanelStable=0;

            chanelLast=c;

        }

        const products = await page.evaluate(()=>{

            let data=[];

            document.querySelectorAll("a[href*='/p/']").forEach(a=>{

                let img = a.querySelector("img");
                if(!img) return;

                let image = img.currentSrc || img.src;
                if(!image) return;

                data.push({ url:a.href, image });

            });

            return data;

        });

        products.forEach(p=>{ if(p.url) collected.set(p.url, p); });

    }finally{

        await context.close();

    }

}


async function scrapeChanel(url, brand, category){


    const browser = await chromium.launch({
        headless:false
    });


    try{


        console.log("Ouverture Chanel (mobile)...");

        const collected = new Map();

        for(const catUrl of [url, ...EXTRA_CATEGORIES]){

            try{
                await scrapeOneListing(browser, catUrl, collected);
                console.log(catUrl, "-> total cumulé:", collected.size);
            }catch(e){
                console.log("Erreur listing sur", catUrl, ":", e.message);
            }

        }

        const products = Array.from(collected.values());


        console.log("Fiches produit trouvées:", products.length);


        // visite chaque fiche produit — la session de la page liste se fait
        // bloquer si on continue à naviguer dedans, donc chaque fiche est
        // visitée dans un contexte tout neuf (cookies vierges), ce qui
        // contourne fiablement le blocage.
        const capped = products.slice(0,300);

        const results = [];


        for(const p of capped){


            let productContext;

            try{

                productContext = await browser.newContext({
                    ...devices["iPhone 13"],
                    locale:"fr-FR"
                });

                const productPage = await productContext.newPage();


                await productPage.goto(p.url,{
                    waitUntil:"domcontentloaded",
                    timeout:30000
                });


                await productPage.waitForTimeout(1800);


                const price = await productPage.evaluate(()=>{

                    let price = "";

                    document.querySelectorAll('script[type="application/ld+json"]').forEach(script=>{

                        try{

                            let obj = JSON.parse(script.innerText);

                            if(obj.offers){

                                let offer = Array.isArray(obj.offers) ? obj.offers[0] : obj.offers;

                                if(offer && offer.price) price = offer.price;

                            }

                        }catch(e){}

                    });

                    return price;

                });


                results.push({

                    name: nameFromSlug(p.url),

                    price: price ? `${price} €` : "Prix inconnu",

                    image: p.image,

                    url: p.url

                });


            }catch(e){

                results.push({

                    name: nameFromSlug(p.url),

                    price: "Prix inconnu",

                    image: p.image,

                    url: p.url

                });

            }
            finally{

                if(productContext) await productContext.close();

            }


        }


        console.log("PRODUITS TROUVES:", results.length);


        return results;


    }
    catch(e){


        console.log("ERREUR:", e.message);

        return [];


    }
    finally{

        await browser.close();

    }


}


module.exports = scrapeChanel;
