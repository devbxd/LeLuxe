const { scrapeShopifyBrand } = require("./_shopify");

module.exports = async function scrapeRickOwens(){
    console.log("Ouverture Rick Owens (Shopify)...");
    const items = await scrapeShopifyBrand("https://www.rickowens.eu", 20);
    console.log("PRODUITS TROUVES:", items.length);
    return items;
};
