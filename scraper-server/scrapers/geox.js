const { chromium } = require("playwright");
const { classifyDept, genderFromUrl, setCollectedItem } = require("./_shared");

// La page generique "femme/"/"homme/" n'affiche qu'une selection limitee :
// les sous-categories precises (chaussures/sneakers, vetements/manteaux...)
// couvrent bien plus de produits.
const CATEGORIES = [
    "https://www.geox.com/fr-FR/femme/",
    "https://www.geox.com/fr-FR/femme/chaussures/sneakers/",
    "https://www.geox.com/fr-FR/femme/chaussures/sandales/",
    "https://www.geox.com/fr-FR/femme/chaussures/ballerines/",
    "https://www.geox.com/fr-FR/femme/chaussures/mocassins/",
    "https://www.geox.com/fr-FR/femme/chaussures/escarpins/",
    "https://www.geox.com/fr-FR/femme/chaussures/chaussures_a_talons/",
    "https://www.geox.com/fr-FR/femme/chaussures/chaussures_a_semelle_compensee/",
    "https://www.geox.com/fr-FR/femme/chaussures/slip_on/",
    "https://www.geox.com/fr-FR/femme/chaussures/bottines/",
    "https://www.geox.com/fr-FR/femme/chaussures/bottes/",
    "https://www.geox.com/fr-FR/femme/vetements/vestes/",
    "https://www.geox.com/fr-FR/femme/vetements/anoraks/",
    "https://www.geox.com/fr-FR/femme/vetements/vestes_matelassees/",
    "https://www.geox.com/fr-FR/femme/vetements/manteaux/",
    "https://www.geox.com/fr-FR/femme/vetements/parkas/",
    "https://www.geox.com/fr-FR/femme/vetements/vestes_sans_manches/",
    "https://www.geox.com/fr-FR/femme/vetements/sweat-shirts/",
    "https://www.geox.com/fr-FR/femme/vetements/maille/",
    "https://www.geox.com/fr-FR/femme/vetements/t-shirts_et_polos/",
    "https://www.geox.com/fr-FR/femme/accessoires/sacs/",
    "https://www.geox.com/fr-FR/femme/accessoires/chaussettes/",
    "https://www.geox.com/fr-FR/femme/accessoires/ceintures/",
    "https://www.geox.com/fr-FR/femme/accessoires/portefeuilles/",
    "https://www.geox.com/fr-FR/homme/",
    "https://www.geox.com/fr-FR/homme/chaussures/sneakers/",
    "https://www.geox.com/fr-FR/homme/chaussures/sandales/",
    "https://www.geox.com/fr-FR/homme/chaussures/mocassins/",
    "https://www.geox.com/fr-FR/homme/chaussures/slip_on/",
    "https://www.geox.com/fr-FR/homme/chaussures/espadrilles/",
    "https://www.geox.com/fr-FR/homme/chaussures/chaussures_habillees/",
    "https://www.geox.com/fr-FR/homme/chaussures/chaussures_casual/",
    "https://www.geox.com/fr-FR/homme/chaussures/bottes_et_bottines/",
    "https://www.geox.com/fr-FR/homme/vetements/vestes/",
    "https://www.geox.com/fr-FR/homme/vetements/anoraks/",
    "https://www.geox.com/fr-FR/homme/vetements/vestes_matelassees/",
    "https://www.geox.com/fr-FR/homme/vetements/vestes_sans_manches/",
    "https://www.geox.com/fr-FR/homme/vetements/sweat-shirts/",
    "https://www.geox.com/fr-FR/homme/vetements/maille/",
    "https://www.geox.com/fr-FR/homme/vetements/t-shirts_et_polos/",
    "https://www.geox.com/fr-FR/homme/accessoires/sacs/",
    "https://www.geox.com/fr-FR/homme/accessoires/ceintures/",
    "https://www.geox.com/fr-FR/homme/accessoires/chaussettes/",
    "https://www.geox.com/fr-FR/homme/accessoires/portefeuilles/"
];

async function scrapeOneCategory(page, url, collected){

    await page.goto(url, { waitUntil:"load", timeout:30000 });
    await page.waitForTimeout(6000);

    let stable=0, last=0;
    for(let i=0;i<40 && stable<8;i++){
        await page.mouse.wheel(0,1200);
        await page.waitForTimeout(600);
        const c = await page.evaluate(()=>document.querySelectorAll("[data-pid]").length);
        if(c===last) stable++; else stable=0;
        last=c;
    }

    const products = await page.evaluate(()=>{
        let data=[];
        document.querySelectorAll("[data-pid]").forEach(tile=>{
            const img = tile.querySelector("img");
            const name = img ? img.alt.replace(/\s*\|\s*GEOX\s*$/i,'').trim() : "";
            const image = img ? (img.currentSrc || img.src) : "";
            const priceEl = tile.querySelector('[class*=price],[class*=Price]');
            const m = priceEl ? priceEl.textContent.match(/[\d,.]+\s*€/) : null;
            const a = tile.closest("a") || tile.querySelector("a");
            const link = a ? a.href : "";
            if(!name || !image || !link) return;
            data.push({ name, price: m?m[0]:"Prix inconnu", image, url: link });
        });
        return data;
    });

    products.forEach(p=>{
        setCollectedItem(collected, p.url, {
            name: p.name,
            price: p.price,
            image: p.image,
            url: p.url,
            dept: classifyDept(p.name, "chaussures"),
            gender: genderFromUrl(url)
        });
    });

}

async function scrapeGeox(url, brand, category){

    const browser = await chromium.launch({ headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox'] });

    try{

        console.log("Ouverture Geox...");

        const collected = new Map();

        for(const catUrl of [url, ...CATEGORIES]){

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

        const capped = Array.from(collected.values());

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

module.exports = scrapeGeox;
