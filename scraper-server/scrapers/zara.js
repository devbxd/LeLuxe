const { chromium } = require("playwright");

// Zara ne rend pas le nom/prix dans le DOM final (widget React côté client),
// mais la page appelle sa propre API interne pour peupler la grille :
// GET /fr/fr/category/{id}/products?ajax=true — on intercepte cette réponse
// JSON (déjà publique, déjà appelée par le navigateur) plutôt que de parser
// le HTML.

const CATEGORY_PAGES = [
    "https://www.zara.com/fr/fr/s-femme-collection-l8862.html"
];

const FAMILY_TO_DEPT = {
    "T-SHIRT":"tshirt", "POLO SHIRT":"tshirt",
    "SHIRT":"chemise", "OVERSHIRT":"chemise",
    "SWEATER":"pull", "SWEATSHIRT":"pull", "KNITTED WAISTCOAT":"pull",
    "BLAZER":"veste", "WIND-JACKET":"veste", "COAT":"veste", "WAISTCOAT":"veste",
    "TROUSERS":"pantalon",
    "BERMUDA":"short",
    "MOCCASINS":"chaussures", "SANDAL":"chaussures", "SPORT SHOES":"chaussures",
    "SHOES":"chaussures", "RUNNING SHOES":"chaussures", "ANKLE BOOT":"chaussures",
    "HAND BAG-RUCKSACK":"sacs",
    "HAT":"casquette",
    "GLASSES":"lunettes",
    "IMIT JEWELLER":"bijoux",
    "BELT":"ceinture"
};

function deptFor(familyName){
    return FAMILY_TO_DEPT[familyName] || "access";
}

function imageUrl(component){
    try{
        const media = component.detail.colors[0].xmedia[0];
        return media.extraInfo.deliveryUrl.replace("?ts=", "?w=800&ts=") || media.url.replace("{width}","800");
    }catch(e){
        return "";
    }
}

function productUrl(component){
    try{
        return `https://www.zara.com/fr/fr/${component.seo.keyword}-p${component.seo.seoProductId}.html`;
    }catch(e){
        return "";
    }
}

async function scrapeOneCategory(page, url, collected){

    let captured = false;

    const handler = async (res) => {
        if(/category\/\d+\/products\?ajax=true/.test(res.url())){
            try{
                const json = await res.json();
                (json.productGroups||[]).forEach(g=>{
                    (g.elements||[]).forEach(e=>{
                        (e.commercialComponents||[]).forEach(c=>{
                            if(c.type!=="Product" || !c.name || !c.price) return;
                            const url2 = productUrl(c);
                            const image = imageUrl(c);
                            if(!url2 || !image) return;
                            collected.set(url2, {
                                name: c.name,
                                price: (c.price/100).toFixed(2).replace(".",",") + " €",
                                image,
                                url: url2,
                                dept: deptFor(c.familyName)
                            });
                        });
                    });
                });
                captured = true;
            }catch(e){}
        }
    };

    page.on("response", handler);

    await page.goto(url,{ waitUntil:"domcontentloaded", timeout:60000 });
    await page.waitForTimeout(7000);

    page.off("response", handler);

    return captured;
}

async function scrapeZara(url, brand, category){

    const browser = await chromium.launch({ headless:false });

    try{

        console.log("Ouverture Zara...");

        const collected = new Map();

        for(const catUrl of [url, ...CATEGORY_PAGES]){

            if(collected.size >= 1200) break;

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

        const capped = Array.from(collected.values()).slice(0,1200);

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

module.exports = scrapeZara;
