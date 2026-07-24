const { scrapeShopifyBrand } = require("./_shopify");

module.exports = async function scrapeSelfPortrait(){
    console.log("Ouverture Self-Portrait (Shopify)...");
    const items = await scrapeShopifyBrand("https://www.self-portrait.com", 20);
    items.forEach(i=>{ if(!i.gender) i.gender = "femme"; });
    console.log("PRODUITS TROUVES:", items.length);
    return items;
};
