// Beaucoup de sites e-commerce publient un JSON-LD "ItemList" complet sur
// leurs pages catégorie (SEO), qui contient déjà name/url/image/price pour
// TOUS les produits de la page — sans avoir besoin de scroller. Ce module
// extrait ce JSON-LD quand il existe.

async function extractItemListFromPage(page){
    return await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        const out = [];
        for(const s of scripts){
            let json;
            try{ json = JSON.parse(s.textContent); }catch(e){ continue; }
            const candidates = Array.isArray(json) ? json : [json];
            for(const j of candidates){
                if(j && j['@type']==='ItemList' && Array.isArray(j.itemListElement)){
                    j.itemListElement.forEach(el=>{
                        const p = el.item || el; // certains sites imbriquent sous "item"
                        if(!p || !p.name) return;
                        let price = null;
                        if(p.offers){
                            const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
                            if(offer && offer.price) price = offer.price;
                        }
                        out.push({
                            name: p.name,
                            url: p.url || el.url || "",
                            image: typeof p.image === 'string' ? p.image : (Array.isArray(p.image) ? p.image[0] : (p.image && p.image.url) || ""),
                            price: price!=null ? `${price} €` : "Prix inconnu"
                        });
                    });
                }
            }
        }
        return out;
    });
}

module.exports = { extractItemListFromPage };
