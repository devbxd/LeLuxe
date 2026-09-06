// Envoie un email (en anglais) à tous les abonnés Hermès quand le patron
// ajoute un nouveau sac depuis le dashboard (voir handleAddItem/
// notifyHermesSubscribers dans dashboard.html). Les emails sont récoltés
// via le formulaire de la boutique (table Supabase hermes_subscribers) et
// envoyés avec Resend (https://resend.com).
//
// Variables d'environnement à définir sur Netlify (Site settings →
// Environment variables) :
//   RESEND_API_KEY  (obligatoire) - clé API du compte Resend
//   RESEND_FROM     (optionnel)   - ex: "Le Luxe Paris <hello@tondomaine.com>"
//                                   par défaut: onboarding@resend.dev (n'envoie
//                                   qu'à l'email du compte Resend tant qu'aucun
//                                   domaine n'est vérifié dans Resend)

const SUPABASE_URL = "https://tyrvocpneofqbbcntmyq.supabase.co";
const SUPABASE_KEY = "sb_publishable_HJUwd63ym-pG91fhAGgVEQ_m3h1QH44";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY manquante dans les variables d'environnement Netlify");
    return { statusCode: 500, body: "Email service not configured" };
  }
  const FROM = process.env.RESEND_FROM || "Le Luxe Paris <onboarding@resend.dev>";
  const SITE_URL = process.env.URL || "";

  let item;
  try {
    item = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const name = (item.name || "A new piece").toString();
  const price = typeof item.price === "number" ? item.price : null;
  const image = item.image || null;

  let subscribers;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/hermes_subscribers?select=email`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error(`Supabase read failed: ${res.status}`);
    subscribers = await res.json();
  } catch (e) {
    console.error("Impossible de lire les abonnés Hermès:", e.message);
    return { statusCode: 500, body: "Could not read subscribers" };
  }

  const emails = [...new Set(subscribers.map((s) => s.email).filter(Boolean))];
  if (!emails.length) {
    return { statusCode: 200, body: JSON.stringify({ sent: 0, total: 0 }) };
  }

  const priceText = price != null ? `$${price.toFixed(2)}` : "";
  const html = buildEmailHtml({ name, priceText, image, siteUrl: SITE_URL });
  const subject = `New Hermès arrival: ${name}`;
  const messages = emails.map((email) => ({ from: FROM, to: email, subject, html }));

  let sent = 0;
  try {
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch)
      });
      if (res.ok) {
        sent += batch.length;
      } else {
        console.error("Resend batch failed:", res.status, await res.text());
      }
    }
  } catch (e) {
    console.error("Erreur envoi Resend:", e.message);
    return { statusCode: 500, body: "Failed to send emails" };
  }

  return { statusCode: 200, body: JSON.stringify({ sent, total: emails.length }) };
};

function buildEmailHtml({ name, priceText, image, siteUrl }) {
  const ctaHref = siteUrl || "#";
  return `<!doctype html>
<html><body style="margin:0;background:#f6f6f4;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ececec;">
        <tr><td style="background:linear-gradient(135deg,#e2670e,#c44f04);padding:28px 32px;">
          <p style="margin:0;color:#fff;font-size:11px;letter-spacing:.2em;text-transform:uppercase;opacity:.85;">Le Luxe Paris</p>
          <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:600;">A new Hermès bag just landed</h1>
        </td></tr>
        ${image ? `<tr><td><img src="${image}" alt="${escapeHtml(name)}" width="480" style="width:100%;display:block;object-fit:cover;max-height:360px;"></td></tr>` : ""}
        <tr><td style="padding:28px 32px 8px;">
          <p style="margin:0 0 6px;font-size:18px;color:#111;font-weight:600;">${escapeHtml(name)}</p>
          ${priceText ? `<p style="margin:0;font-size:14px;color:#8a8a8a;">${priceText}</p>` : ""}
        </td></tr>
        <tr><td style="padding:8px 32px 32px;">
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#444;">Come take a look before it's gone — our Hermès selection is refreshed with every new arrival, and pieces move fast.</p>
          <a href="${escapeHtml(ctaHref)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 26px;border-radius:30px;font-size:13px;font-weight:700;letter-spacing:.02em;">Discover the selection</a>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #ececec;">
          <p style="margin:0;font-size:11px;color:#a3a3a3;">You're receiving this because you signed up for Hermès updates on Le Luxe Paris.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
