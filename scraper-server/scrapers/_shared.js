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

module.exports = { classifyDept, genderFromUrl, genderFromText, DEPT_RULES };
