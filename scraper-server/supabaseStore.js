// Stockage partage du catalogue sur Supabase.
//
// Avant : tout le catalogue (marques + articles) vivait dans UNE seule ligne
// (id='main') de la table catalog_store. Avec ~28 000 articles, cette ligne
// pese desormais ~10 Mo, et la reecrire en entier a chaque modification
// (un seul article ajoute, un scrape automatique, etc.) depasse le
// statement_timeout de Postgres et echoue silencieusement (erreur 500 cote
// serveur, jamais vue par l'utilisateur). C'est ce qui empechait les ajouts
// depuis le dashboard (ex: sacs Hermes) et les rafraichissements
// automatiques des scrapers de se sauvegarder.
//
// Maintenant : chaque marque est sa propre ligne (id='brand:<brandId>'),
// donc chaque modification ne reecrit que la marque concernee (quelques Ko a
// quelques centaines de Ko), jamais tout le catalogue. La lecture complete
// (id=like.brand:*) rassemble toutes les lignes en un seul objet
// {brands:[...]} identique a l'ancien format, pour ne rien changer au reste
// du code.

const SUPABASE_URL = "https://tyrvocpneofqbbcntmyq.supabase.co";
const SUPABASE_KEY = "sb_publishable_HJUwd63ym-pG91fhAGgVEQ_m3h1QH44";

function headers(extra){
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, ...extra };
}

// Lit toutes les marques (une requete, une ligne par marque) et les
// rassemble dans la meme forme {brands:[...]} qu'avant.
async function fetchCatalog(){
  const res = await fetch(`${SUPABASE_URL}/rest/v1/catalog_store?id=like.brand:*&select=data`, {
    headers: headers()
  });
  if(!res.ok) throw new Error('Erreur de lecture catalogue: ' + res.status);
  const rows = await res.json();
  return { brands: rows.map(r => r.data) };
}

// Le site (boutique.html) revérifiait le catalogue complet toutes les 15s
// pour CHAQUE visiteur, même quand rien n'avait changé : ça a fait dépasser
// le quota gratuit de bande passante Supabase. "catalog_version" est une
// ligne minuscule (un timestamp) qu'on avance à chaque écriture ; le site
// ne compare plus que cette petite valeur en continu, et ne retélécharge
// le catalogue complet que quand elle a changé.
async function bumpVersion(){
  await fetch(`${SUPABASE_URL}/rest/v1/catalog_store?on_conflict=id`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ id: 'catalog_version', data: { v: Date.now() } })
  }).catch(()=>{});
}

// Sauvegarde UNE marque (id, data complets) : n'ecrit qu'une seule ligne,
// jamais tout le catalogue.
async function saveBrand(brand){
  const res = await fetch(`${SUPABASE_URL}/rest/v1/catalog_store?on_conflict=id`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ id: 'brand:' + brand.id, data: brand })
  });
  if(!res.ok) console.error('Echec de sauvegarde de la marque', brand.id, ':', res.status, await res.text());
  else await bumpVersion();
  return res.ok;
}

async function deleteBrand(brandId){
  const res = await fetch(`${SUPABASE_URL}/rest/v1/catalog_store?id=eq.brand:${encodeURIComponent(brandId)}`, {
    method: 'DELETE',
    headers: headers({ Prefer: 'return=minimal' })
  });
  if(res.ok) await bumpVersion();
  return res.ok;
}

module.exports = { SUPABASE_URL, SUPABASE_KEY, fetchCatalog, saveBrand, deleteBrand, bumpVersion };
