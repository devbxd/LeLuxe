const { scrapeShopifyBrand } = require("./_shopify");

module.exports = async function scrapeAmiParis(){
    console.log("Ouverture Ami Paris (Shopify)...");
    const items = await scrapeShopifyBrand("https://www.amiparis.com", 20);
    console.log("PRODUITS TROUVES:", items.length);
    return items;
};
