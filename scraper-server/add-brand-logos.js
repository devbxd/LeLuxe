// Ajoute une image de logo (favicon haute resolution via Google) pour
// chaque marque, dérivée de son site officiel. Fiable meme pour les
// marques dont le site principal est protege par un anti-bot (le service
// de favicon de Google sert l'icone independamment de ca).

const { fetchCatalog, saveBrand } = require('./supabaseStore');

function domainOf(url){
    try{ return new URL(url).hostname.replace(/^www\./, ""); }
    catch(e){ return null; }
}

function faviconUrl(domain){
    return `https://www.google.com/s2/favicons?sz=128&domain_url=https://${domain}`;
}

async function main(){
    const DATA = await fetchCatalog();

    const toSave = [];

    DATA.brands.forEach(b => {
        const src = b.officialUrl || b.sourceUrl || (b.items[0] && (b.items[0].sourceUrl || b.items[0].url));
        const domain = domainOf(src);
        if(!domain) return;
        const newLogo = faviconUrl(domain);
        if(b.logo === newLogo && b.domain === domain) return; // deja a jour, rien a ecrire
        b.logo = newLogo;
        b.domain = domain;
        toSave.push(b);
    });

    console.log("Logos a mettre a jour:", toSave.length, "/", DATA.brands.length);

    // Chaque marque est sa propre ligne : on ne reecrit que celles dont le
    // logo a change, jamais tout le catalogue.
    let ok = 0;
    for(const b of toSave){
        if(await saveBrand(b)) ok++;
    }
    console.log("sauvegardees:", ok, "/", toSave.length);
}

main().catch(e => { console.log("ERREUR:", e.message); process.exit(1); });
