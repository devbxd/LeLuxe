const { chromium } = require("playwright");
const { classifyDept, genderFromUrl, setCollectedItem } = require("./_shared");


const EXTRA_CATEGORIES = [
    "https://www.gucci.com/fr/fr/ca/men/mens-shoes-c-men-shoes",
    "https://www.gucci.com/fr/fr/ca/men/mens-bags-c-men-bags",
    "https://www.gucci.com/fr/fr/ca/men/mens-accessories-c-men-accessories",
    "https://www.gucci.com/fr/fr/ca/men/mens-sunglasses-c-men-sunglasses",
    "https://www.gucci.com/fr/fr/ca/women/ready-to-wear-c-women-readytowear",
    "https://www.gucci.com/fr/fr/ca/women/womens-shoes-c-women-shoes",
    "https://www.gucci.com/fr/fr/ca/women/womens-bags-c-women-handbags"
];


// extrait les cartes produit actuellement hydratées (le reste peut être
// recyclé/vidé par la virtualisation de la grille React)
function extractBatch(){

    let data=[];

    document.querySelectorAll("[data-testid='product-card']").forEach(card=>{

        let img = card.querySelector("img");

        let name = img ? img.alt : "";

        if(!name) return;


        let priceEl = card.querySelector("[data-testid='price']");

        let price = priceEl ? priceEl.innerText.trim() : "Prix inconnu";


        let a = card.closest("a");

        let link = a ? a.href : "";


        let image = img.src || "";

        if(image.startsWith("//")) image = "https:"+image;


        data.push({ name, price, image, url:link });

    });

    return data;

}


async function scrapeOneCategory(page, url, collected){

    await page.goto(url,{
        waitUntil:"domcontentloaded",
        timeout:60000
    });

    await page.waitForTimeout(6000);

    try{
        await page.click("#onetrust-accept-btn-handler", {timeout:3000});
    }catch(e){}

    const total = await page.evaluate(()=>{
        let el = document.querySelector("[data-testid='header.product-count']");
        if(!el) return null;
        let m = el.innerText.match(/\d+/);
        return m ? parseInt(m[0],10) : null;
    });

    console.log(url, "-> total annoncé:", total);

    // la grille est virtualisée (React) : seules les cartes proches du
    // scroll actuel sont réellement hydratées, les autres redeviennent
    // des coquilles vides. On récupère donc les données juste après
    // chaque nouveau chargement de page, en scrollant vers le bas
    // (là où se trouve le nouveau lot), avant de passer à la suite.
    const before = collected.size;
    let pageNum = 1;

    for(let i=0;i<6;i++){
        await page.mouse.wheel(0,900);
        await page.waitForTimeout(600);
    }

    while(true){

        const batch = await page.evaluate(extractBatch);
        batch.forEach(p=>{
            if(!p.url) return;
            setCollectedItem(collected, p.url, {
                name: p.name,
                price: p.price,
                image: p.image,
                url: p.url,
                dept: classifyDept(p.name),
                gender: genderFromUrl(url)
            });
        });

        const gained = collected.size - before;
        if(total && gained >= total) break;
        if(gained >= 300) break;
        if(pageNum > 20) break;

        pageNum++;

        await page.goto(`${url}?page=${pageNum}`,{
            waitUntil:"domcontentloaded",
            timeout:60000
        });

        await page.waitForTimeout(2000);

        // hydrater le nouveau lot en bas de la liste avant de le lire
        await page.evaluate(()=>window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(900);
        await page.evaluate(()=>window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(900);

    }

}


async function scrapeGucci(url, brand, category){


    const browser = await chromium.launch({
        headless:false
    });


    try{


        console.log("Ouverture Gucci...");

        const collected = new Map();

        for(const catUrl of [url, ...EXTRA_CATEGORIES]){

            const page = await browser.newPage({ viewport:{ width:1440, height:900 } });

            try{
                await scrapeOneCategory(page, catUrl, collected);
            }catch(e){
                console.log("Erreur sur", catUrl, ":", e.message);
            }finally{
                await page.close();
            }

        }


        const products = Array.from(collected.values());


        console.log("PRODUITS TROUVES:", products.length);


        return products;


    }catch(error){


        console.log("Erreur scraping:", error.message);

        return [];


    }
    finally{

        await browser.close();

    }


}


module.exports = scrapeGucci;
