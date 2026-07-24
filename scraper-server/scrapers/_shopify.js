// Beaucoup de marques tournent sur Shopify, qui expose par défaut une API
// JSON publique et non protégée : GET /products.json?limit=250&page=N.
// Pas besoin de navigateur du tout — un simple fetch suffit, et c'est fiable
// à 100% (pas de scroll, pas de virtualisation, pas d'anti-bot en général).

const { classifyDept } = require("./_shared");

async function fetchAllShopifyProducts(baseUrl, maxPages){
    const all = [];
    for(let page=1; page<=(maxPages||10); page++){
        const url = `${baseUrl}/products.json?limit=250&page=${page}`;
        try{
            const res = await fetch(url, { headers:{ "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" } });
            if(!res.ok) break;
            const json = await res.json();
            const products = json.products || [];
            if(products.length === 0) break;
            all.push(...products);
            if(products.length < 250) break; // dernière page
        }catch(e){ break; }
    }
    return all;
}

function shopifyProductToItem(p, baseUrl, genderHint){
    const variants = p.variants || [];
    // certains variants (ex: options de gravure gratuites) sont à 0 — on
    // prend le prix le plus élevé parmi les variantes, plus représentatif
    const bestPrice = variants.reduce((max, v) => {
        const val = parseFloat(v.price);
        return isNaN(val) ? max : Math.max(max, val);
    }, 0);
    const image = (p.images && p.images[0] && p.images[0].src) || (p.image && p.image.src) || "";
    if(!image || !p.title) return null;
    const price = bestPrice > 0 ? `${bestPrice.toFixed(2)} €` : null;
    const url = `${baseUrl}/products/${p.handle}`;
    const typeHint = p.product_type || "";
    return {
        name: p.title,
        price: price || "Prix inconnu",
        image,
        url,
        dept: classifyDept(p.title, classifyDept(typeHint)),
        gender: genderHint || null
    };
}

// scrape générique : renvoie un tableau prêt pour push-to-supabase
async function scrapeShopifyBrand(baseUrl, maxPages){
    const raw = await fetchAllShopifyProducts(baseUrl, maxPages);
    const seen = new Set();
    const out = [];
    raw.forEach(p=>{
        const item = shopifyProductToItem(p, baseUrl);
        if(!item || seen.has(item.url)) return;
        seen.add(item.url);
        out.push(item);
    });
    return out;
}

module.exports = { fetchAllShopifyProducts, shopifyProductToItem, scrapeShopifyBrand };
