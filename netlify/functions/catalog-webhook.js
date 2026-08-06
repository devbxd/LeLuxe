// Appelée par un Supabase Database Webhook à chaque UPDATE de la ligne
// catalog_store/main (ajouts manuels via dashboard.html OU ajouts
// automatiques du serveur de scraping — les deux passent par la même
// table, donc ce webhook les voit tous les deux).
//
// Compare record (nouvel état) à old_record (état juste avant) fourni par
// Supabase dans le payload du webhook : pas besoin de mémoriser nous-mêmes
// "ce qui a déjà été notifié", chaque appel ne regarde que ce qui vient de
// changer dans CETTE sauvegarde précise.

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'Le Luxe <onboarding@resend.dev>';
const SITE_URL = process.env.SITE_URL;
const WEBHOOK_SECRET = process.env.CATALOG_WEBHOOK_SECRET;
const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET;
const PRICE_THRESHOLD = Number(process.env.PRICE_THRESHOLD || 100);

function collectItems(data) {
  const map = new Map();
  ((data && data.brands) || []).forEach(b => {
    (b.items || []).forEach(it => {
      map.set(it.id, { ...it, brandName: b.name, brandId: b.id });
    });
  });
  return map;
}

function unsubscribeToken(email) {
  return crypto.createHmac('sha256', UNSUBSCRIBE_SECRET).update(email.toLowerCase()).digest('hex');
}

function fmtPrice(v) {
  return (v == null ? '' : v.toLocaleString('fr-FR')) + ' €';
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buildEmailHtml(items, email) {
  const shown = items.slice(0, 12);
  const more = items.length - shown.length;
  const rows = shown.map(it => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #eee;">
        ${it.image ? `<img src="${escapeHtml(it.image)}" width="64" height="64" style="width:64px;height:64px;object-fit:cover;border-radius:6px;background:#f6f6f6;vertical-align:middle;margin-right:14px;">` : ''}
        <span style="display:inline-block;vertical-align:middle;">
          <span style="display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#b08d57;">${escapeHtml(it.brandName)}</span>
          <span style="display:block;font-size:15px;color:#111;margin-top:2px;">${escapeHtml(it.name)}</span>
          <span style="display:block;font-size:13px;color:#555;margin-top:2px;">${fmtPrice(it.price)}</span>
        </span>
      </td>
    </tr>`).join('');
  const token = unsubscribeToken(email);
  const unsubUrl = `${SITE_URL}/.netlify/functions/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
  const siteLink = items[0] && items[0].brandId ? `${SITE_URL}/boutique.html?brand=${encodeURIComponent(items[0].brandId)}` : SITE_URL;
  return `
  <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111;">
    <div style="text-align:center;letter-spacing:.3em;font-size:20px;text-transform:uppercase;margin-bottom:6px;">Le Luxe</div>
    <div style="text-align:center;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#b08d57;margin-bottom:26px;">Nouvelles pièces</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    ${more > 0 ? `<p style="font-size:12.5px;color:#888;margin-top:14px;">+ ${more} autre${more > 1 ? 's' : ''} nouvelle${more > 1 ? 's' : ''} pièce${more > 1 ? 's' : ''} sur le site.</p>` : ''}
    <div style="text-align:center;margin-top:28px;">
      <a href="${siteLink}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:13px 28px;border-radius:24px;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;font-family:Arial,sans-serif;">Voir sur le site</a>
    </div>
    <p style="text-align:center;font-size:10.5px;color:#aaa;margin-top:32px;font-family:Arial,sans-serif;">
      Vous recevez cet email car vous vous êtes inscrit sur leluxe. <a href="${unsubUrl}" style="color:#aaa;">Se désinscrire</a>
    </p>
  </div>`;
}

async function sendBatch(emails) {
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(emails)
  });
  if (!res.ok) console.error('Resend batch send failed:', res.status, await res.text());
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  if (WEBHOOK_SECRET && event.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !RESEND_API_KEY || !SITE_URL || !UNSUBSCRIBE_SECRET) {
    console.error('Variables d\'environnement manquantes pour catalog-webhook');
    return { statusCode: 500, body: 'Missing config' };
  }

  let payload;
  try { payload = JSON.parse(event.body); } catch (e) { return { statusCode: 400, body: 'Bad payload' }; }

  const { type, record, old_record } = payload || {};
  if (type !== 'UPDATE' || !record || record.id !== 'main' || !old_record) {
    return { statusCode: 200, body: 'Ignored' };
  }

  const oldItems = collectItems(old_record.data);
  const newItems = collectItems(record.data);
  const added = [];
  for (const [id, item] of newItems) {
    if (!oldItems.has(id) && item.price != null && item.price >= PRICE_THRESHOLD) {
      added.push(item);
    }
  }
  if (added.length === 0) return { statusCode: 200, body: 'No qualifying new items' };

  let subscribers;
  try {
    const subRes = await fetch(`${SUPABASE_URL}/rest/v1/newsletter_subscribers?active=eq.true&select=email`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }
    });
    subscribers = await subRes.json();
  } catch (e) {
    console.error('Impossible de lire les abonnés:', e);
    return { statusCode: 500, body: 'Subscriber fetch failed' };
  }
  if (!Array.isArray(subscribers) || subscribers.length === 0) {
    return { statusCode: 200, body: 'No subscribers' };
  }

  const subject = added.length > 1
    ? `${added.length} nouvelles pièces chez Le Luxe`
    : `Nouveau : ${added[0].name} chez Le Luxe`;

  const emails = subscribers.map(s => ({
    from: RESEND_FROM,
    to: s.email,
    subject,
    html: buildEmailHtml(added, s.email)
  }));

  for (let i = 0; i < emails.length; i += 100) {
    await sendBatch(emails.slice(i, i + 100));
  }

  return { statusCode: 200, body: `Notified ${subscribers.length} subscriber(s) about ${added.length} item(s)` };
};
