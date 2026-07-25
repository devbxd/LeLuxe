// Logique de fusion partagee entre push-to-supabase.js (CLI, une marque a la
// fois) et server.js (rafraichissement depuis le dashboard) : upsert des
// articles scrapes dans une marque existante, matching par sourceUrl,
// generation d'id et de reference pour les nouveaux articles.

const { classifyDept, genderFromUrl } = require('./scrapers/_shared');

function parsePrice(raw){
  if(typeof raw === 'number') return isNaN(raw) ? null : raw;
  if(typeof raw !== 'string') return null;

  const euroMid = raw.match(/(\d+)\s*€\s*(\d+)/);
  if(euroMid && !/[.,]/.test(raw)){
    const v = parseFloat(euroMid[1] + '.' + euroMid[2]);
    return isNaN(v) ? null : v;
  }

  let s = raw.replace(/[€\s ]/g,'');
  const match = s.match(/[\d.,]+/);
  if(!match) return null;
  let num = match[0];

  if(num.includes(',')){
    num = num.replace(/\./g,'').replace(',', '.');
  } else if(num.includes('.')){
    const parts = num.split('.');
    if(parts[parts.length-1].length === 3){
      num = parts.join('');
    }
  }

  const v = parseFloat(num);
  return isNaN(v) ? null : v;
}

function genId(){
  return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2,9);
}

// Meme format de reference que le reste du catalogue (prefixe = 3 premieres
// lettres du nom de marque + numero sequentiel), pour que les articles
// ajoutes via un re-scrape restent cherchables par reference sur le site.
function makeRefAssigner(brand){
  const clean = (brand.name||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-zA-Z]/g,'').toUpperCase();
  const prefix = clean.slice(0,3) || 'ART';
  let maxSeq = 0;
  brand.items.forEach(it=>{
    if(it.ref && it.ref.startsWith(prefix+'-')){
      const n = parseInt(it.ref.slice(prefix.length+1),10);
      if(!isNaN(n) && n>maxSeq) maxSeq = n;
    }
  });
  return () => { maxSeq++; return prefix + '-' + String(maxSeq).padStart(4,'0'); };
}

// Fusionne une liste d'articles scrapes {name, price, image, url, dept?,
// gender?} dans une marque existante. Retourne le nombre d'articles ajoutes
// et mis a jour.
function mergeItemsIntoBrand(brand, scraped, category){
  if(!brand.items) brand.items = [];
  const existingByUrl = new Map(brand.items.filter(it=>it.sourceUrl).map(it=>[it.sourceUrl, it]));
  const nextRef = makeRefAssigner(brand);
  let added = 0, updated = 0;

  (scraped||[]).forEach(p=>{
    const gender = p.gender || genderFromUrl(p.url) || null;
    if(p.url && existingByUrl.has(p.url)){
      const existing = existingByUrl.get(p.url);
      existing.name = p.name || existing.name;
      const price = parsePrice(p.price);
      if(price!=null) existing.price = price;
      existing.image = p.image || existing.image;
      existing.dept = p.dept || classifyDept(p.name, existing.dept);
      existing.gender = gender || existing.gender || null;
      if(!existing.ref) existing.ref = nextRef();
      updated++;
      return;
    }
    const newItem = {
      id: genId(),
      ref: nextRef(),
      name: p.name || 'Produit',
      dept: p.dept || classifyDept(p.name, category),
      gender,
      price: parsePrice(p.price),
      image: p.image || null,
      addedAt: Date.now(),
      sourceUrl: p.url || null
    };
    brand.items.push(newItem);
    if(p.url) existingByUrl.set(p.url, newItem);
    added++;
  });

  return { added, updated };
}

module.exports = { parsePrice, genId, makeRefAssigner, mergeItemsIntoBrand };
