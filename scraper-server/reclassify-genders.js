// Passe de reclassification homme/femme sur tout le catalogue : le texte du
// nom du produit est plus fiable que l'URL de catégorie (certaines pages
// mélangent les genres, ou l'URL ne contient aucun indice). Corrige aussi
// les items mal étiquetés à la source.

const SUPABASE_URL = "https://tyrvocpneofqbbcntmyq.supabase.co";
const SUPABASE_KEY = "sb_publishable_HJUwd63ym-pG91fhAGgVEQ_m3h1QH44";
const { genderFromUrl } = require("./scrapers/_shared");

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
    const res = await fetch(`${SUPABASE_URL}/rest/v1/catalog_store?id=eq.main&select=data`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const rows = await res.json();
    const DATA = rows[0].data;

    const report = {};

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
        }
    });

    console.log(JSON.stringify(report, null, 2));

    const putRes = await fetch(`${SUPABASE_URL}/rest/v1/catalog_store?on_conflict=id`, {
        method: "POST",
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify({ id: "main", data: DATA })
    });

    console.log("save status:", putRes.status);
}

main().catch(e => { console.log("ERREUR:", e.message); process.exit(1); });
