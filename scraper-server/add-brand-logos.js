// Ajoute une image de logo (favicon haute resolution via Google) pour
// chaque marque, dérivée de son site officiel. Fiable meme pour les
// marques dont le site principal est protege par un anti-bot (le service
// de favicon de Google sert l'icone independamment de ca).

const SUPABASE_URL = "https://tyrvocpneofqbbcntmyq.supabase.co";
const SUPABASE_KEY = "sb_publishable_HJUwd63ym-pG91fhAGgVEQ_m3h1QH44";

function domainOf(url){
    try{ return new URL(url).hostname.replace(/^www\./, ""); }
    catch(e){ return null; }
}

function faviconUrl(domain){
    return `https://www.google.com/s2/favicons?sz=128&domain_url=https://${domain}`;
}

async function main(){
    const res = await fetch(`${SUPABASE_URL}/rest/v1/catalog_store?id=eq.main&select=data`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const rows = await res.json();
    const DATA = rows[0].data;

    let updated = 0;

    DATA.brands.forEach(b => {
        const src = b.officialUrl || b.sourceUrl || (b.items[0] && (b.items[0].sourceUrl || b.items[0].url));
        const domain = domainOf(src);
        if(!domain) return;
        b.logo = faviconUrl(domain);
        b.domain = domain;
        updated++;
    });

    console.log("Logos ajoutes:", updated, "/", DATA.brands.length);

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
