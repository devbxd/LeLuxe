const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET;

function page(title, message) {
  return `<!doctype html><html lang="fr"><head><meta charset="UTF-8"><title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>body{font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fff;color:#111;text-align:center;padding:24px;}
  div{max-width:420px;}h1{font-size:20px;letter-spacing:.05em;margin-bottom:14px;}p{font-size:14px;color:#666;line-height:1.6;}</style></head>
  <body><div><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !UNSUBSCRIBE_SECRET) {
    return { statusCode: 500, body: 'Missing config' };
  }

  const email = (event.queryStringParameters || {}).email;
  const token = (event.queryStringParameters || {}).token;
  if (!email || !token) {
    return { statusCode: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: page('Lien invalide', "Ce lien de désinscription n'est pas valide.") };
  }

  const expected = crypto.createHmac('sha256', UNSUBSCRIBE_SECRET).update(email.toLowerCase()).digest('hex');
  const valid = expected.length === token.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  if (!valid) {
    return { statusCode: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: page('Lien invalide', "Ce lien de désinscription n'est pas valide.") };
  }

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/newsletter_subscribers?email=eq.${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ active: false })
    });
  } catch (e) {
    return { statusCode: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: page('Erreur', 'Impossible de traiter la désinscription pour le moment, réessayez plus tard.') };
  }

  return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: page('Désinscription confirmée', `${email} ne recevra plus d'alertes de Le Luxe.`) };
};
