const { chromium } = require("playwright");
const { classifyDept, setCollectedItem } = require("./_shared");

// Zara ne rend pas le nom/prix dans le DOM final (widget React côté client),
// mais la page appelle sa propre API interne pour peupler la grille :
// GET /fr/fr/category/{id}/products?ajax=true — on intercepte cette réponse
// JSON (déjà publique, déjà appelée par le navigateur) plutôt que de parser
// le HTML. Chaque URL de catégorie est étiquetée homme/femme pour que les
// articles récupérés héritent du bon genre (l'API ne le renvoie pas elle-même).

const CATEGORY_PAGES = [
    ["https://www.zara.com/fr/fr/homme-toute-la-collection-l7465.html", "homme"],
    ["https://www.zara.com/fr/fr/s-femme-collection-l8862.html", "femme"],
    ["https://www.zara.com/fr/fr/homme-chaussures-l769.html", "homme"],
    ["https://www.zara.com/fr/fr/femme-chaussures-l1216.html", "femme"],
    ["https://www.zara.com/fr/fr/homme-sacs-l715.html", "homme"],
    ["https://www.zara.com/fr/fr/femme-sacs-l1024.html", "femme"],
    ["https://www.zara.com/fr/fr/homme-accessoires-l537.html", "homme"],
    ["https://www.zara.com/fr/fr/femme-accessoires-l1003.html", "femme"]
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

function deptFor(familyName, name){
    return FAMILY_TO_DEPT[familyName] || classifyDept(name, "access");
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

async function scrapeOneCategory(page, url, gender, collected){

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
                            setCollectedItem(collected, url2, {
                                name: c.name,
                                price: (c.price/100).toFixed(2).replace(".",",") + " €",
                                image,
                                url: url2,
                                dept: deptFor(c.familyName, c.name),
                                gender
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

        for(const [catUrl, gender] of CATEGORY_PAGES){

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

module.exports = scrapeZara;
