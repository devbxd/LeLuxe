const {chromium}=require("playwright");


async function scrape(url,brand,category){


const browser = await chromium.launch({
headless: process.env.PLAYWRIGHT_HEADED !== '1', args:['--no-sandbox','--disable-setuid-sandbox','--blink-settings=imagesEnabled=false']
});


const page = await browser.newPage({
viewport:{
width:1440,
height:900
}
});


try{


console.log("Ouverture:",url);



await page.goto(url,{
waitUntil:"domcontentloaded",
timeout:60000
});



await page.waitForTimeout(5000);



for(let i=0;i<5;i++){

await page.mouse.wheel(0,800);

await page.waitForTimeout(1000);

}



const products = await page.evaluate(()=>{


let data=[];

const CURRENCY = /[€$£]|\bEUR\b|\bUSD\b/;



document.querySelectorAll("img")
.forEach(img=>{


let src =
img.currentSrc ||
img.src;


if(!src || !src.startsWith("http")) return;


// filtre les icônes/logos/pixels trop petits pour être une photo produit
let w = img.naturalWidth || img.width || 0;
let h = img.naturalHeight || img.height || 0;

if(w && h && (w<120 || h<120)) return;

if(/logo|sprite|icon|placeholder/i.test(src)) return;


let link = img.closest("a")?.href || "";


// cherche un nom/prix dans les conteneurs parents de l'image
let name = "";
let price = "";
let container = img.parentElement;

for(let depth=0; depth<5 && container && !name; depth++){

    let lines = (container.innerText || "")
        .split("\n")
        .map(x=>x.trim())
        .filter(Boolean);

    if(!price){
        price = lines.find(x=>CURRENCY.test(x)) || "";
    }

    name = lines.find(x=>!CURRENCY.test(x) && x.length>1 && x.length<120) || "";

    container = container.parentElement;

}


if(!name){
    name = img.alt || img.title || "Produit";
}


data.push({

name,

price: price || "Prix inconnu",

image:src,

url:link

});



});



return data;



});



return products.map(p=>({

brand,
category,
...p

}));



}
finally{

await browser.close();

}


}


module.exports=scrape;