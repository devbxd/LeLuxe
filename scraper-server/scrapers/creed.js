const { scrapeShopifyBrand } = require("./_shopify");

module.exports = async function scrapeCreed(){
    console.log("Ouverture Creed (Shopify)...");
    const items = await scrapeShopifyBrand("https://www.creedboutique.com", 5);
    items.forEach(i=>{ i.dept = "access"; });
    console.log("PRODUITS TROUVES:", items.length);
    return items;
};
