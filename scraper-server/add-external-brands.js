// Ajoute les marques dont le catalogue n'a pas pu être récupéré (anti-bot /
// blocage géo) comme entrées "vitrine" : nom + lien vers le site officiel,
// sans produits. Classées luxe / pasluxe selon leur positionnement réel.

const SUPABASE_URL = "https://tyrvocpneofqbbcntmyq.supabase.co";
const SUPABASE_KEY = "sb_publishable_HJUwd63ym-pG91fhAGgVEQ_m3h1QH44";

const EXTERNAL_BRANDS = [
    // ---------- LUXE ----------
    ["Christian Louboutin", "https://eu.christianlouboutin.com", "luxe"],
    ["Roger Vivier", "https://www.rogervivier.com", "luxe"],
    ["Tod's", "https://www.tods.com", "luxe"],
    ["Manolo Blahnik", "https://www.manoloblahnik.com", "luxe"],
    ["Moncler", "https://www.moncler.com", "luxe"],
    ["Stone Island", "https://www.stoneisland.com", "luxe"],
    ["Canada Goose", "https://www.canadagoose.com", "luxe"],
    ["Canali", "https://www.canali.com", "luxe"],
    ["Palm Angels", "https://www.palmangels.com", "luxe"],
    ["Off-White", "https://www.off---white.com", "luxe"],
    ["Prada", "https://www.prada.com", "luxe"],
    ["Miu Miu", "https://www.miumiu.com", "luxe"],
    ["Valentino", "https://www.valentino.com", "luxe"],
    ["Loewe", "https://www.loewe.com", "luxe"],
    ["Fendi", "https://www.fendi.com", "luxe"],
    ["Van Cleef & Arpels", "https://www.vancleefarpels.com", "luxe"],
    ["Bvlgari", "https://www.bulgari.com", "luxe"],
    ["Piaget", "https://www.piaget.com", "luxe"],
    ["Omega", "https://www.omegawatches.com", "luxe"],
    ["Patek Philippe", "https://www.patek.com", "luxe"],
    ["Audemars Piguet", "https://www.audemarspiguet.com", "luxe"],
    ["Byredo", "https://www.byredo.com", "luxe"],
    ["Le Labo", "https://www.lelabofragrances.com", "luxe"],
    ["Maison Francis Kurkdjian", "https://www.maisonfranciskurkdjian.com", "luxe"],
    ["Zadig & Voltaire", "https://www.zadig-et-voltaire.com", "luxe"],
    ["Marine Serre", "https://www.marineserre.com", "luxe"],
    ["Loro Piana", "https://www.loropiana.com", "luxe"],
    ["Brunello Cucinelli", "https://www.brunellocucinelli.com", "luxe"],
    ["Zegna", "https://www.zegna.com", "luxe"],
    ["Berluti", "https://www.berluti.com", "luxe"],
    ["Tom Ford", "https://www.tomford.com", "luxe"],
    ["Brioni", "https://www.brioni.com", "luxe"],
    ["Hermès", "https://www.hermes.com", "luxe"],
    ["Louis Vuitton", "https://www.louisvuitton.com", "luxe"],
    ["Dior", "https://www.dior.com", "luxe"],
    ["Saint Laurent", "https://www.ysl.com", "luxe"],
    ["Céline", "https://www.celine.com", "luxe"],
    ["Goyard", "https://www.goyard.com", "luxe"],
    ["Delvaux", "https://www.delvaux.com", "luxe"],
    ["Alaïa", "https://www.maison-alaia.com", "luxe"],
    ["Maison Margiela", "https://www.maisonmargiela.com", "luxe"],
    ["Chopard", "https://www.chopard.com", "luxe"],
    ["Golden Goose", "https://www.goldengoose.com", "luxe"],
    ["Jacquemus", "https://www.jacquemus.com", "luxe"],

    // ---------- PAS LUXE ----------
    ["Coach", "https://www.coach.com", "pasluxe"],
    ["Furla", "https://www.furla.com", "pasluxe"],
    ["Kate Spade", "https://www.katespade.com", "pasluxe"],
    ["Longchamp", "https://www.longchamp.com", "pasluxe"],
    ["Sézane", "https://www.sezane.com", "pasluxe"],
    ["Caroll", "https://www.caroll.com", "pasluxe"],
    ["Adidas", "https://www.adidas.fr", "pasluxe"],
    ["Nike", "https://www.nike.com", "pasluxe"],
    ["Clarks", "https://www.clarks.com", "pasluxe"],
    ["UGG", "https://www.ugg.com", "pasluxe"],
    ["Dr. Martens", "https://www.drmartens.com", "pasluxe"],
    ["Timberland", "https://www.timberland.com", "pasluxe"],
    ["Skechers", "https://www.skechers.com", "pasluxe"],
    ["Sephora Collection", "https://www.sephora.fr", "pasluxe"],
    ["Caudalie", "https://www.caudalie.com", "pasluxe"],
    ["La Roche-Posay", "https://www.laroche-posay.fr", "pasluxe"],
    ["Avène", "https://www.eau-thermale-avene.com", "pasluxe"],
    ["Kiehl's", "https://www.kiehls.fr", "pasluxe"],
    ["Rituals", "https://www.rituals.com", "pasluxe"],
    ["New Balance", "https://www.newbalance.fr", "pasluxe"],
    ["ASICS", "https://www.asics.com", "pasluxe"],
    ["Hoka", "https://www.hoka.com", "pasluxe"],
    ["Under Armour", "https://www.underarmour.com", "pasluxe"],
    ["Lululemon", "https://www.lululemon.com", "pasluxe"],
    ["IKKS", "https://www.ikks.com", "pasluxe"],
    ["Comptoir des Cotonniers", "https://www.comptoirdescotonniers.com", "pasluxe"],
    ["Mango", "https://shop.mango.com", "pasluxe"],
    ["Muji", "https://www.muji.com", "pasluxe"],
    ["Massimo Dutti", "https://www.massimodutti.com", "pasluxe"],
    ["Celio", "https://www.celio.com", "pasluxe"],
    ["Devred", "https://www.devred.fr", "pasluxe"],
    ["Promod", "https://www.promod.fr", "pasluxe"]
];

function slugId(name){
    return "ext_" + name.toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "");
}

async function main(){
    const res = await fetch(`${SUPABASE_URL}/rest/v1/catalog_store?id=eq.main&select=data`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const rows = await res.json();
    const DATA = rows[0].data;

    const existingIds = new Set(DATA.brands.map(b => b.id));
    const existingNames = new Set(DATA.brands.map(b => b.name.toLowerCase()));

    let added = 0, updated = 0;

    EXTERNAL_BRANDS.forEach(([name, url, universe]) => {
        const id = slugId(name);
        const already = DATA.brands.find(b => b.id === id || b.name.toLowerCase() === name.toLowerCase());
        if(already){
            already.external = true;
            already.officialUrl = url;
            already.universe = universe;
            if(!already.items) already.items = [];
            updated++;
            return;
        }
        DATA.brands.push({
            id,
            name,
            items: [],
            universe,
            external: true,
            officialUrl: url
        });
        added++;
    });

    console.log("Ajoutées:", added, "Mises à jour:", updated, "Total marques:", DATA.brands.length);

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
