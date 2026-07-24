// Utilitaires partagés par les scrapers : classification du rayon (dept) à
// partir du nom du produit, et détection homme/femme à partir de l'URL ou
// d'un indice textuel. Centralisé ici pour que toute nouvelle marque
// bénéficie de la même catégorisation fine sans dupliquer les règles.

const DEPT_RULES = [
  [/casquette|bonnet|chapeau|\bbob\b/i, "casquette"],
  [/lunette/i, "lunettes"],
  [/ceinture/i, "ceinture"],
  [/portefeuille|pochette|porte-?cartes|petite maroquinerie|porte-?monnaie/i, "maroquinerie"],
  [/\bsac\b|sacoche|cabas|besace|\bsacs\b|handbag|backpack/i, "sacs"],
  [/basket|sneaker|derby|derbie|mocassin|sandale|bottine|\bbotte\b|escarpin|\btong\b|slipper|espadrille|chaussure|richelieu|loafer|\bshoe/i, "chaussures"],
  [/\bjupe\b|\bskirt\b/i, "jupe"],
  [/\brobe\b|\bdress\b/i, "robe"],
  [/short|bermuda/i, "short"],
  [/\bjean\b|denim/i, "jean"],
  [/pantalon|jogging|jogger|\btrouser|\bpant\b/i, "pantalon"],
  [/veste|manteau|blouson|parka|trench|doudoune|blazer|\bcoat\b|\bjacket\b/i, "veste"],
  [/pull|sweat|cardigan|\bgilet\b|maille|knit|\bhoodie\b/i, "pull"],
  [/t-?shirt|tee-?shirt|\bpolo\b/i, "tshirt"],
  [/chemise|\bshirt\b/i, "chemise"],
  [/bijou|collier|bracelet|bague\b|boucle.*oreille|\bjewel/i, "bijoux"],
  [/montre|\bwatch\b/i, "bijoux"],
  [/parfum|eau de (parfum|toilette)|\bfragrance\b/i, "access"]
];

function classifyDept(name, fallback){
  if(!name) return fallback || "vetements";
  for(const [re, dept] of DEPT_RULES){
    if(re.test(name)) return dept;
  }
  return fallback || "vetements";
}

function genderFromUrl(url){
  if(!url) return null;
  if(/\/(homme|men|man|male|man-)\b/i.test(url)) return "homme";
  if(/\/(femme|women|woman|female|femme-)\b/i.test(url)) return "femme";
  return null;
}

function genderFromText(text){
  if(!text) return null;
  if(/^man\b|_man_|gendered man/i.test(text)) return "homme";
  if(/^woman\b|_woman_|gendered woman/i.test(text)) return "femme";
  return null;
}

// Beaucoup de scrapers alimentent une Map "collected" en bouclant sur des
// URLs de catégorie homme puis femme : si le même produit (même URL) se
// retrouve listé dans les deux (article unisexe, tuile de recommandation
// croisée...), la boucle femme écrasait silencieusement le genre "homme"
// déjà enregistré (dernier écrit gagne) — c'est ce qui faisait apparaître
// des articles homme dans le filtre femme (ex: Lacoste). On centralise
// l'écriture ici : en cas de conflit de genre sur une même clé, on ne
// tranche pas au hasard, on marque l'article ambigu (gender:null) plutôt
// que de lui attribuer arbitrairement le genre du dernier passage.
function setCollectedItem(collected, key, item){
  if(!key) return;
  const existing = collected.get(key);
  if(!existing){
    collected.set(key, item);
    return;
  }
  if(existing.gender && item.gender && existing.gender !== item.gender){
    // vu sous les deux genres -> ambigu, on ne tranche pas au hasard
    collected.set(key, { ...existing, ...item, gender: null });
  } else if(!item.gender && existing.gender){
    // le nouveau passage n'a pas de genre connu : on garde celui déjà établi
    collected.set(key, { ...existing, ...item, gender: existing.gender });
  } else {
    collected.set(key, item);
  }
}

module.exports = { classifyDept, genderFromUrl, genderFromText, setCollectedItem, DEPT_RULES };
