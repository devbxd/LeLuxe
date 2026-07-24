// Plateforme utilisée par COS / Arket / & Other Stories (groupe H&M) : la
// page catégorie (Next.js) embarque déjà la liste complète des produits de
// la page dans le JSON #__NEXT_DATA__ (props.pageProps.blocks[].initialResult.items),
// pas besoin de scroller ni d'appeler une API séparée.

async function extractNextDataProducts(page, baseUrl){
    return await page.evaluate((base) => {
        const el = document.querySelector('#__NEXT_DATA__');
        if(!el) return [];
        let json;
        try{ json = JSON.parse(el.textContent); }catch(e){ return []; }
        const blocks = json?.props?.pageProps?.blocks || [];
        const block = blocks.find(b => b && b.initialResult && Array.isArray(b.initialResult.items));
        if(!block) return [];
        return block.initialResult.items.map(it => ({
            name: it.name,
            price: it.lowestPrice || it.price || null,
            image: (it.images && it.images[0] && it.images[0].src) || "",
            url: it.uri ? `${base}/${it.categoryUri || ''}/product/${it.uri}`.replace(/\/{2,}/g,'/').replace('https:/','https://') : "",
            categoryUri: it.categoryUri || ""
        })).filter(p => p.name && p.image);
    }, baseUrl);
}

module.exports = { extractNextDataProducts };
