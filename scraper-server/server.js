const express = require("express");
const fs = require("fs");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());


const browserScraper = require("./scrapers/browserScraper");
const scrapeLacoste = require("./scrapers/lacoste");
const scrapeChanel = require("./scrapers/chanel");
const scrapeGucci = require("./scrapers/gucci");
const scrapeVersace = require("./scrapers/versace");
const scrapeBalenciaga = require("./scrapers/balenciaga");
const scrapeGivenchy = require("./scrapers/givenchy");
const scrapeBurberry = require("./scrapers/burberry");
const scrapeRolex = require("./scrapers/rolex");
const scrapeTiffany = require("./scrapers/tiffany");
const scrapeJules = require("./scrapers/jules");
const scrapeLaHalle = require("./scrapers/lahalle");
const scrapeUniqlo = require("./scrapers/uniqlo");
const scrapeMaje = require("./scrapers/maje");
const scrapeVeja = require("./scrapers/veja");
const scrapeArmaniExchange = require("./scrapers/armaniexchange");
const scrapeBottegaVeneta = require("./scrapers/bottegaveneta");
const scrapeZara = require("./scrapers/zara");
const brands = require("./scrapers/brands");

// scraper dédié par marque, fallback générique sinon
const SCRAPERS = {
    Lacoste: scrapeLacoste,
    Chanel: scrapeChanel,
    Gucci: scrapeGucci,
    Versace: scrapeVersace,
    Balenciaga: scrapeBalenciaga,
    Givenchy: scrapeGivenchy,
    Burberry: scrapeBurberry,
    Rolex: scrapeRolex,
    Tiffany: scrapeTiffany,
    Jules: scrapeJules,
    LaHalle: scrapeLaHalle,
    Uniqlo: scrapeUniqlo,
    Maje: scrapeMaje,
    Veja: scrapeVeja,
    ArmaniExchange: scrapeArmaniExchange,
    BottegaVeneta: scrapeBottegaVeneta,
    Zara: scrapeZara
};


const DATABASE = "./database/products.json";

let importing = false;



app.get("/", (req,res)=>{
    res.send("Scraper OK");
});





app.post("/import", async(req,res)=>{


if(importing){

    return res.status(429).json({
        error:"Import déjà en cours"
    });

}


importing = true;



try{


const {
    brand,
    category
} = req.body;



console.log(
    "IMPORT",
    brand,
    category
);




if(!brands[brand]){

    importing=false;

    return res.status(400).json({
        error:"Marque inconnue"
    });

}




const url = brands[brand][category];



if(!url){

    importing=false;

    const dispo = Object.keys(brands[brand]).join(", ");

    return res.status(400).json({
        error:`${brand} n'a pas de catégorie "${category}" configurée (disponible : ${dispo})`
    });

}





const scraperFn = SCRAPERS[brand] || browserScraper;

const products = await scraperFn(url, brand, category);





const finalProducts = products.map(p=>({

    brand: brand,
    category: category,
    name: p.name || "Produit",
    price: p.price || "Prix inconnu",
    image: p.image || null,
    url: p.url || url

}));






let old=[];



if(fs.existsSync(DATABASE)){


    try{


        const content = fs.readFileSync(
            DATABASE,
            "utf8"
        );


        old = JSON.parse(content);



        if(!Array.isArray(old)){
            old=[];
        }


    }
    catch(e){


        console.log(
            "Database vide ou corrompue, reset"
        );


        old=[];


    }



}






old.push(...finalProducts);

// dédoublonnage par marque + url (ou image si pas d'url)
const seen = new Set();
old = old.filter(p=>{
    const key = `${p.brand}|${p.url || p.image}`;
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
});





fs.writeFileSync(

    DATABASE,

    JSON.stringify(
        old,
        null,
        2
    )

);

console.log("FICHIER SAUVEGARDE :", DATABASE);
console.log("NOMBRE TOTAL :", old.length);





console.log(
    "AJOUTES:",
    finalProducts.length
);





res.json({

    success:true,

    products:finalProducts

});



}
catch(e){


console.log(e);


res.status(500).json({

    error:e.message

});


}


finally{


importing=false;


}



});






app.listen(3000,()=>{


console.log(
    "Serveur lancé http://localhost:3000"
);


});