const { scrapeShopifyBrand } = require("./_shopify");

module.exports = async function scrapeIsabelMarant(){
    console.log("Ouverture Isabel Marant (Shopify)...");
    const items = await scrapeShopifyBrand("https://www.isabelmarant.com", 20);
    console.log("PRODUITS TROUVES:", items.length);
    return items;
};
