// Passe de nettoyage finale sur tout le catalogue :
// - noms avec espaces/retours à la ligne en trop -> collapse
// - noms manquants/trop courts ("0", "", null) -> dérivés du sourceUrl
// - images manquantes -> item marqué (juste rapporté, pas de fix possible sans re-scrape)

const { fetchCatalog, saveBrand } = require('./supabaseStore');

function nameFromUrl(url){
    try{
        const u = new URL(url);
        let parts = u.pathname.split("/").filter(Boolean);
        let slug = parts[parts.length-1] || "";
        slug = slug.replace(/\.html?$/i, "");
        // enlève les codes produit type A006Q22ACRZ5723 ou 8657602ACFH1000 en fin de slug
        slug = slug.replace(/-[A-Z0-9]{8,}$/i, "");
        slug = slug.replace(/[-_]+/g, " ").trim();
        if(!slug) return null;
        return slug.charAt(0).toUpperCase() + slug.slice(1);
    }catch(e){
        return null;
    }
}

function cleanWhitespace(name){
    return name.replace(/\s+/g, " ").trim();
}

async function main(){
    const DATA = await fetchCatalog();

    const report = {};
    const touched = [];
    let totalNoImage = 0;
    let totalBadImage = 0;

    DATA.brands.forEach(brand=>{
        let renamed = 0;
        let whitespaceFixed = 0;
        let noImage = 0;

        brand.items.forEach(item=>{

            if(!item.image){
                noImage++;
                totalNoImage++;
            } else if(/^data:/.test(item.image) || /placeholder/i.test(item.image)){
                totalBadImage++;
            }

            if(!item.name || item.name.trim().length < 2 || /^\d+$/.test(item.name.trim())){
                const derived = item.sourceUrl ? nameFromUrl(item.sourceUrl) : null;
                if(derived){
                    item.name = derived;
                    renamed++;
                }
                return;
            }

            const cleaned = cleanWhitespace(item.name);
            if(cleaned !== item.name){
                item.name = cleaned;
                whitespaceFixed++;
            }

        });

        if(renamed || whitespaceFixed || noImage){
            report[brand.name] = { renamed, whitespaceFixed, noImage };
        }
        if(renamed || whitespaceFixed) touched.push(brand);
    });

    console.log(JSON.stringify(report, null, 2));
    console.log("TOTAL noImage:", totalNoImage, "TOTAL badImage(data-uri/placeholder):", totalBadImage);

    // Seules les marques dont un nom a vraiment changé sont réécrites.
    let ok = 0;
    for(const brand of touched){
        if(await saveBrand(brand)) ok++;
    }
    console.log('sauvegardées:', ok, '/', touched.length);
}

main().catch(e=>{ console.log('ERREUR:', e.message); process.exit(1); });
