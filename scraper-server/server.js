// Serveur local utilise par le bouton "Rafraîchir les nouveautés" du
// dashboard : relance les scrapers marque par marque et pousse les
// nouveaux articles directement dans Supabase (mergeLogic.js), avec un
// etat de progression interrogeable par le dashboard pour afficher une
// barre de chargement en temps reel.
//
// Doit tourner sur le meme ordinateur que celui qui ouvre le dashboard
// (les scrapers pilotent un vrai navigateur via Playwright, ce qui est
// impossible a faire depuis la page web elle-meme) : node server.js

const express = require("express");
const cors = require("cors");
const { mergeItemsIntoBrand } = require("./mergeLogic");

const SUPABASE_URL = "https://tyrvocpneofqbbcntmyq.supabase.co";
const SUPABASE_KEY = "sb_publishable_HJUwd63ym-pG91fhAGgVEQ_m3h1QH44";

const app = express();
app.use(cors());
app.use(express.json());

// scraper dedie par marque (nom exact tel que stocke dans Supabase)
const SCRAPERS = {
  Lacoste: require("./scrapers/lacoste"),
  Zara: require("./scrapers/zara"),
  Uniqlo: require("./scrapers/uniqlo"),
  Veja: require("./scrapers/veja"),
  Chanel: require("./scrapers/chanel"),
  Gucci: require("./scrapers/gucci"),
  Versace: require("./scrapers/versace"),
  Balenciaga: require("./scrapers/balenciaga"),
  Givenchy: require("./scrapers/givenchy"),
  Burberry: require("./scrapers/burberry"),
  Rolex: require("./scrapers/rolex"),
  Tiffany: require("./scrapers/tiffany"),
  Jules: require("./scrapers/jules"),
  LaHalle: require("./scrapers/lahalle"),
  Maje: require("./scrapers/maje"),
  ArmaniExchange: require("./scrapers/armaniexchange"),
  BottegaVeneta: require("./scrapers/bottegaveneta"),
  Sandro: require("./scrapers/sandro"),
  ClaudiePierlot: require("./scrapers/claudiepierlot"),
  TheKooples: require("./scrapers/thekooples"),
  BaAndSh: require("./scrapers/bash"),
  COS: require("./scrapers/cos"),
  OtherStories: require("./scrapers/otherstories"),
  Arket: require("./scrapers/arket"),
  AmericanVintage: require("./scrapers/americanvintage"),
  Etam: require("./scrapers/etam"),
  Birkenstock: require("./scrapers/birkenstock"),
  MichaelKors: require("./scrapers/michaelkors"),
  JimmyChoo: require("./scrapers/jimmychoo"),
  Cartier: require("./scrapers/cartier"),
  Balmain: require("./scrapers/balmain"),
  Geox: require("./scrapers/geox"),
  SelfPortrait: require("./scrapers/selfportrait"),
  RickOwens: require("./scrapers/rickowens"),
  AmiParis: require("./scrapers/amiparis"),
  IsabelMarant: require("./scrapers/isabelmarant"),
  ParfumsDeMarly: require("./scrapers/parfumsdemarly"),
  Initio: require("./scrapers/initio"),
  Creed: require("./scrapers/creed")
};

async function fetchCatalog(){
  const res = await fetch(`${SUPABASE_URL}/rest/v1/catalog_store?id=eq.main&select=data`, {
    headers:{ apikey: SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}` }
  });
  const rows = await res.json();
  return rows[0] ? rows[0].data : { brands: [] };
}

async function saveCatalog(data){
  const res = await fetch(`${SUPABASE_URL}/rest/v1/catalog_store?on_conflict=id`, {
    method:'POST',
    headers:{
      apikey: SUPABASE_KEY,
      Authorization:`Bearer ${SUPABASE_KEY}`,
      'Content-Type':'application/json',
      Prefer:'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({ id:'main', data })
  });
  return res.ok;
}

let progress = { running:false, total:0, done:0, currentBrand:null, results:[], startedAt:null, finishedAt:null };

app.get("/", (req,res)=>{
  res.send("Scraper OK");
});

app.get("/refresh-all/status", (req,res)=>{
  res.json(progress);
});

app.post("/refresh-all", (req,res)=>{
  if(progress.running){
    return res.status(429).json({ error:"Un rafraîchissement est déjà en cours." });
  }

  const brandNames = Object.keys(SCRAPERS);
  progress = { running:true, total:brandNames.length, done:0, currentBrand:null, results:[], startedAt:Date.now(), finishedAt:null };
  res.json({ started:true, total:brandNames.length });

  (async ()=>{
    let DATA;
    try{
      DATA = await fetchCatalog();
    }catch(e){
      progress.running = false;
      progress.finishedAt = Date.now();
      progress.results.push({ brand:null, error:"Impossible de lire le catalogue: "+e.message });
      return;
    }

    for(const brandName of brandNames){
      progress.currentBrand = brandName;
      try{
        const brand = DATA.brands.find(b=> b.name.toLowerCase() === brandName.toLowerCase());
        if(!brand){
          progress.results.push({ brand:brandName, error:"Marque introuvable dans le catalogue" });
        }else{
          const scraperFn = SCRAPERS[brandName];
          const scraped = await scraperFn('', brandName, 'refresh');
          const { added, updated } = mergeItemsIntoBrand(brand, scraped || [], 'vetements');
          progress.results.push({ brand:brandName, added, updated, total: brand.items.length });
          // sauvegarde apres chaque marque : si le process s'arrete en
          // cours de route, le travail deja fait n'est pas perdu
          await saveCatalog(DATA);
        }
      }catch(e){
        progress.results.push({ brand:brandName, error: e.message });
      }
      progress.done++;
    }

    progress.running = false;
    progress.currentBrand = null;
    progress.finishedAt = Date.now();
  })();
});

app.post("/refresh/:brand", async (req,res)=>{
  const brandName = req.params.brand;
  const scraperFn = SCRAPERS[brandName];
  if(!scraperFn){
    return res.status(400).json({ error:`Pas de scraper disponible pour "${brandName}"` });
  }
  try{
    const DATA = await fetchCatalog();
    const brand = DATA.brands.find(b=> b.name.toLowerCase() === brandName.toLowerCase());
    if(!brand) return res.status(404).json({ error:"Marque introuvable dans le catalogue" });

    const scraped = await scraperFn('', brandName, 'refresh');
    const { added, updated } = mergeItemsIntoBrand(brand, scraped || [], 'vetements');
    await saveCatalog(DATA);
    res.json({ brand: brandName, added, updated, total: brand.items.length });
  }catch(e){
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 5678;
app.listen(PORT, ()=>{
  console.log(`Serveur lancé sur le port ${PORT}`);
  console.log("Marques disponibles pour le rafraîchissement:", Object.keys(SCRAPERS).length);
});
