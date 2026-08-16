const { chromium } = require("playwright");
const { classifyDept, setCollectedItem } = require("./_shared");

// Chaque URL de catégorie est étiquetée homme/femme (le site ne l'expose
// pas au niveau de la tuile) — la version précédente ne scrapait que des
// catégories homme, laissant le rayon femme entièrement vide.
const CATEGORIES = [
    ["https://www.lacoste.com/fr/lacoste/homme/vetements/", "homme"],
    ["https://www.lacoste.com/fr/lacoste/homme/chaussures/", "homme"],
    ["https://www.lacoste.com/fr/lacoste/homme/sacs-et-maroquinerie/", "homme"],
    ["https://www.lacoste.com/fr/lacoste/homme/accessoires/", "homme"],
    ["https://www.lacoste.com/fr/lacoste/femme/vetements/", "femme"],
    ["https://www.lacoste.com/fr/lacoste/femme/chaussures/", "femme"],
    ["https://www.lacoste.com/fr/lacoste/femme/sacs-et-maroquinerie/", "femme"],
    ["https://www.lacoste.com/fr/lacoste/femme/accessoires/", "femme"]
];

async function scrapeOneCategory(page, url, gender, collected){

    await page.goto(url,{ waitUntil:"domcontentloaded", timeout:60000 });
    await page.waitForTimeout(5000);

    for(let i=0;i<8;i++){
        await page.mouse.wheel(0,900);
        await page.waitForTimeout(1200);
    }

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

    const products = await page.evaluate(()=>{
        let data=[];
        document.querySelectorAll("[data-pid]").forEach(tile=>{
            let nameEl = tile.querySelector(".js-product-tile-title");
            let name = nameEl ? nameEl.innerText.trim() : "";
            if(!name) return;

            let priceEl = tile.querySelector(".sales-price") || tile.querySelector("[class*='price']");
            let price = priceEl ? priceEl.innerText.trim().split("\n")[0] : "Prix inconnu";

            let link = tile.querySelector("a.product-tile-link")?.href || tile.querySelector("a")?.href || "";

            let img = tile.querySelector("img[src*='impolicy=pctp']") || tile.querySelector("img");
            let image = img ? (img.currentSrc || img.src) : "";
            if(image) image = image.replace(/imwidth=\d+/, "imwidth=600");
            if(!image) return;

            data.push({ name, price, image, url: link });
        });
        return data;
    });

    products.forEach(p=>{
        const key = p.url || p.image;
        if(!key) return;
        setCollectedItem(collected, key, { name: p.name, price: p.price, image: p.image, url: p.url, gender });
    });

}

async function scrapeLacoste(url, brand, category){

    const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox','--blink-settings=imagesEnabled=false'] });

    try{

        console.log("Ouverture Lacoste...");

        const collected = new Map();

        for(const [catUrl, gender] of CATEGORIES){

            const page = await browser.newPage({ viewport:{ width:1440, height:900 } });

            try{
                const before = collected.size;
                await scrapeOneCategory(page, catUrl, gender, collected);
                console.log(catUrl, "->", collected.size-before, "produits (total", collected.size, ")");
            }catch(e){
                console.log("Erreur sur", catUrl, ":", e.message);
            }finally{
                await page.close();
            }

        }

        const withDept = Array.from(collected.values()).map(p=>({
            name: p.name, price: p.price, image: p.image, url: p.url,
            gender: p.gender, dept: classifyDept(p.name, "vetements")
        }));

        console.log("PRODUITS TROUVES:", withDept.length);

        return withDept;

    }catch(error){

        console.log("Erreur scraping:", error.message);
        return [];

    }
    finally{

        await browser.close();

    }

}

module.exports = scrapeLacoste;
