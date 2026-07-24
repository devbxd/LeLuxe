const { scrapeShopifyBrand } = require("./_shopify");

module.exports = async function scrapeParfumsDeMarly(){
    console.log("Ouverture Parfums de Marly (Shopify)...");
    const items = await scrapeShopifyBrand("https://www.parfums-de-marly.com", 5);
    items.forEach(i=>{ i.dept = "access"; });
    console.log("PRODUITS TROUVES:", items.length);
    return items;
};
