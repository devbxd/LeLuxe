const { chromium } = require("playwright");
const { classifyDept, genderFromUrl, setCollectedItem } = require("./_shared");

const CATEGORIES = [
    "https://fr.sandro-paris.com/fr/femme/pret-a-porter/",
    "https://fr.sandro-paris.com/fr/femme/sacs/",
    "https://fr.sandro-paris.com/fr/femme/chaussures/",
    "https://fr.sandro-paris.com/fr/femme/accessoires/",
    "https://fr.sandro-paris.com/fr/femme/casquettes-bobs/",
    "https://fr.sandro-paris.com/fr/femme/lunettes-de-soleil/",
    "https://fr.sandro-paris.com/fr/femme/ceintures/",
    "https://fr.sandro-paris.com/fr/homme/pret-a-porter/",
    "https://fr.sandro-paris.com/fr/homme/chaussures/",
    "https://fr.sandro-paris.com/fr/homme/maroquinerie/",
    "https://fr.sandro-paris.com/fr/homme/accessoires/",
    "https://fr.sandro-paris.com/fr/homme/casquettes-bobs/",
    "https://fr.sandro-paris.com/fr/homme/lunettes-de-soleil/",
    "https://fr.sandro-paris.com/fr/homme/ceintures/"
];

async function scrapeOneCategory(page, url, collected){

    await page.goto(url,{ waitUntil:"domcontentloaded", timeout:60000 });
    await page.waitForTimeout(5000);

    let stable=0, last=0;
    for(let i=0;i<40 && stable<6;i++){
        await page.mouse.wheel(0,1200);
        await page.waitForTimeout(600);
        const c = await page.evaluate(()=>document.querySelectorAll("[data-pid]").length);
        if(c===last) stable++; else stable=0;
        last=c;
    }

    const products = await page.evaluate(()=>{
        let data=[];
        document.querySelectorAll("[data-pid]").forEach(tile=>{
            let gtm = tile.getAttribute("data-gtmga4data");
            if(!gtm) return;
            let info;
            try{ info = JSON.parse(gtm); }catch(e){ return; }
            if(!info.item_name) return;

            let img = tile.querySelector("img");
            let image = img ? (img.currentSrc || img.src) : "";
            if(!image) return;

            let a = tile.querySelector("a.js-tile-anchor") || tile.querySelector("a");
            let link = a ? a.href : "";

            data.push({
                name: info.item_name,
                price: info.price ? `${info.price} €` : "Prix inconnu",
                image,
                url: link,
                category: info.item_category3 || info.item_category2 || "",
                gender: info.item_gender || ""
            });
        });
        return data;
    });

    products.forEach(p=>{
        let key = p.url || p.image;
        if(!key) return;
        const gender = /woman/i.test(p.gender) ? "femme" : /man/i.test(p.gender) ? "homme" : genderFromUrl(url);
        setCollectedItem(collected, key, {
            name: p.name,
            price: p.price,
            image: p.image,
            url: p.url,
            dept: classifyDept(p.name, classifyDept(p.category)),
            gender
        });
    });

}

async function scrapeSandro(url, brand, category){

    const browser = await chromium.launch({ headless:false });

    try{

        console.log("Ouverture Sandro...");

        const collected = new Map();

        for(const catUrl of [url, ...CATEGORIES]){

            if(collected.size >= 300) break;

            const page = await browser.newPage({ viewport:{ width:1440, height:900 } });

            try{
                const before = collected.size;
                await scrapeOneCategory(page, catUrl, collected);
                console.log(catUrl, "->", collected.size-before, "produits (total", collected.size, ")");
            }catch(e){
                console.log("Erreur sur", catUrl, ":", e.message);
            }finally{
                await page.close();
            }

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

module.exports = scrapeSandro;
