// Passe de reclassification homme/femme sur tout le catalogue : le texte du
// nom du produit est plus fiable que l'URL de catégorie (certaines pages
// mélangent les genres, ou l'URL ne contient aucun indice). Corrige aussi
// les items mal étiquetés à la source.

const { genderFromUrl } = require("./scrapers/_shared");
const { fetchCatalog, saveBrand } = require("./supabaseStore");

// mots qui indiquent explicitement le genre dans le nom du produit
function genderFromName(name){
    if(!name) return null;
    if(/\bhomme\b|\bhommes\b|\bmen'?s\b|\bfor men\b/i.test(name)) return "homme";
    if(/\bfemme\b|\bfemmes\b|\bwomen'?s\b|\bfor women\b|\bladies\b/i.test(name)) return "femme";
    return null;
}

// certains rayons sont quasi exclusivement portés par un genre dans ces
// catalogues (robe/jupe = femme, costume/cravate = homme) : utilisé
// uniquement en dernier recours quand ni l'URL ni le nom ne tranchent
function genderFromDept(dept){
    if(dept === "robe" || dept === "jupe") return "femme";
    return null;
}

async function main(){
    const DATA = await fetchCatalog();

    const report = {};
    const touched = [];

    DATA.brands.forEach(brand => {
        if(brand.external) return;
        let changed = 0;
        let filled = 0;

        brand.items.forEach(item => {
            const textGender = genderFromName(item.name);

            if(textGender && textGender !== item.gender){
                item.gender = textGender;
                changed++;
                return;
            }

            if(!item.gender){
                const urlGender = genderFromUrl(item.sourceUrl) || genderFromDept(item.dept);
                if(urlGender){
                    item.gender = urlGender;
                    filled++;
                }
            }
        });

        if(changed || filled){
            report[brand.name] = { corriges: changed, completes: filled };
            touched.push(brand);
        }
    });

    console.log(JSON.stringify(report, null, 2));

    let ok = 0;
    for(const brand of touched){
        if(await saveBrand(brand)) ok++;
    }
    console.log("sauvegardées:", ok, "/", touched.length);
}

main().catch(e => { console.log("ERREUR:", e.message); process.exit(1); });
