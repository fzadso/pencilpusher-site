// POST /api/checkout — turns the visitor's cart into a Square checkout page.
// Prices come from the published products.json, never from the browser, so they
// always match what Cindy set in her admin page.
//
// Cloudflare Pages → Settings → Variables and Secrets:
//   SQUARE_ACCESS_TOKEN (secret), SQUARE_LOCATION_ID, SQUARE_ENV ("sandbox" only for testing)
import { json, squareApi, siteFile } from "../../lib/util.js";

export async function onRequestPost({ request, env }) {
  if (!env.SQUARE_ACCESS_TOKEN || !env.SQUARE_LOCATION_ID) return json(503, { error: "Online checkout isn't set up yet." });

  let body;
  try { body = await request.json(); } catch { return json(400, { error: "Your cart couldn't be read." }); }
  const cart = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
  if (!cart.length) return json(400, { error: "Your cart is empty." });
  const ship = body.delivery !== "pickup";

  let catalog;
  try { catalog = await (await siteFile(request, env, "/products.json")).json(); }
  catch { return json(502, { error: "Prices couldn't be loaded." }); }
  const byId = Object.fromEntries(catalog.items.map(p => [p.id, p]));

  const lineItems = [];
  const seenOriginals = new Set();
  for (const item of cart) {
    const p = byId[item.id];
    const type = item.type === "original" ? "original" : "print";
    if (!p || p[type] == null) return json(409, { error: `"${p ? p.title : "A piece"}" is no longer available as ${type === "original" ? "an original" : "a print"}. Remove it from your cart to continue.` });
    if (type === "original" && seenOriginals.has(p.id)) continue;
    if (type === "original") seenOriginals.add(p.id);
    const qty = type === "original" ? 1 : Math.min(Math.max(parseInt(item.qty, 10) || 1, 1), 10);
    lineItems.push({
      name: `${p.title} (${type})`.slice(0, 500),
      quantity: String(qty),
      note: [p.medium, p.size, ship ? "" : "LOCAL PICKUP"].filter(Boolean).join(", "),
      base_price_money: { amount: Math.round(p[type] * 100), currency: "USD" },
      metadata: { art_id: p.id, kind: type }, // lets square-webhook mark originals sold
    });
  }

  const hasOriginal = lineItems.some(l => l.metadata.kind === "original");
  const shipFee = ship ? (hasOriginal ? catalog.shipping_original : catalog.shipping_print) : 0;
  const origin = new URL(request.url).origin;

  const payload = {
    idempotency_key: crypto.randomUUID(),
    order: { location_id: env.SQUARE_LOCATION_ID, line_items: lineItems },
    checkout_options: {
      redirect_url: `${origin}/order-complete/`,
      ask_for_shipping_address: ship,
      ...(ship && shipFee > 0 ? { shipping_fee: { name: "Shipping (U.S.)", charge: { amount: Math.round(shipFee * 100), currency: "USD" } } } : {}),
    },
    payment_note: ship ? "Ship to customer" : "Local pickup",
  };

  let r;
  try {
    r = await fetch(`${squareApi(env)}/v2/online-checkout/payment-links`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`, "Content-Type": "application/json", "Square-Version": "2024-01-18" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Square unreachable", err.message);
    return json(502, { error: "Square couldn't be reached." });
  }
  const out = await r.json().catch(() => ({}));
  if (!r.ok || !out.payment_link) {
    console.error("Square error", r.status, JSON.stringify(out.errors || out));
    return json(502, { error: "Square couldn't start checkout." });
  }
  return json(200, { url: out.payment_link.url });
}
