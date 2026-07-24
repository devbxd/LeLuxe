const { scrapeShopifyBrand } = require("./_shopify");

module.exports = async function scrapeInitio(){
    console.log("Ouverture Initio Parfums (Shopify)...");
    const items = await scrapeShopifyBrand("https://www.initioparfums.com", 5);
    items.forEach(i=>{ i.dept = "access"; });
    console.log("PRODUITS TROUVES:", items.length);
    return items;
};
