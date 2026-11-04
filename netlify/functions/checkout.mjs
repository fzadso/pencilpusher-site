// Creates a Square checkout page for the items in a visitor's cart.
// Prices are looked up from the live site (products.json), never trusted from the browser,
// so they always match what Cindy set in her admin page.
//
// Netlify environment variables (Site configuration → Environment variables):
//   SQUARE_ACCESS_TOKEN  Square production access token (keep secret)
//   SQUARE_LOCATION_ID   Square location ID
//   SQUARE_ENV           "production" (default) or "sandbox" for testing

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Use POST." });

  const token = process.env.SQUARE_ACCESS_TOKEN, location = process.env.SQUARE_LOCATION_ID;
  if (!token || !location) return json(503, { error: "Online checkout isn't set up yet." });
  const api = process.env.SQUARE_ENV === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";

  let body;
  try { body = await req.json(); } catch { return json(400, { error: "Your cart couldn't be read." }); }
  const cart = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
  if (!cart.length) return json(400, { error: "Your cart is empty." });
  const ship = body.delivery !== "pickup";

  const origin = new URL(req.url).origin;
  let catalog;
  try {
    const r = await fetch(`${origin}/products.json`, { headers: { "Cache-Control": "no-cache" } });
    catalog = await r.json();
  } catch { return json(502, { error: "Prices couldn't be loaded." }); }
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
      name: `${p.title} (${type === "original" ? "original" : "print"})`.slice(0, 500),
      quantity: String(qty),
      note: [p.medium, p.size].filter(Boolean).join(", "),
      base_price_money: { amount: Math.round(p[type] * 100), currency: "USD" },
    });
  }

  const hasOriginal = lineItems.some(l => l.name.endsWith("(original)"));
  const shipFee = ship ? (hasOriginal ? catalog.shipping_original : catalog.shipping_print) : 0;

  const payload = {
    idempotency_key: crypto.randomUUID(),
    order: {
      location_id: location,
      line_items: lineItems,
    },
    checkout_options: {
      redirect_url: `${origin}/order-complete/`,
      ask_for_shipping_address: ship,
      ...(ship && shipFee > 0 ? { shipping_fee: { name: "Shipping (U.S.)", charge: { amount: Math.round(shipFee * 100), currency: "USD" } } } : {}),
    },
    payment_note: ship ? "Ship to customer" : "Local pickup in the Boise area",
  };
  if (!ship) payload.order.line_items.push({ name: "Local pickup, Boise area (Cindy will email you)", quantity: "1", base_price_money: { amount: 0, currency: "USD" } });

  const r = await fetch(`${api}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Square-Version": "2024-01-18" },
    body: JSON.stringify(payload),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok || !out.payment_link) {
    console.error("Square error", r.status, JSON.stringify(out.errors || out));
    return json(502, { error: "Square couldn't start checkout." });
  }
  return json(200, { url: out.payment_link.url });
};

