// Marks an original "Sold" automatically after Square reports a completed payment.
//
// Flow: Square sends "payment.updated" → we check Square's signature → look up the order →
// for each line item tagged kind=original (tag added by checkout.mjs) we set `sold: true`
// in src/art/<id>.md on GitHub. That commit rebuilds the site, so the piece shows Sold
// and can't be bought again.
//
// Netlify environment variables:
//   SQUARE_ACCESS_TOKEN            (already set for checkout)
//   SQUARE_ENV                     optional, "sandbox" for testing
//   SQUARE_WEBHOOK_SIGNATURE_KEY   from the Square webhook subscription (keep secret)
//   SQUARE_WEBHOOK_URL             the exact notification URL entered in Square
//   GITHUB_TOKEN                   fine-grained token, Contents: read & write on this repo only
//   GITHUB_REPO                    optional, default fzadso/pencilpusher-site
//   GITHUB_BRANCH                  optional, default main

import { createHmac, timingSafeEqual } from "node:crypto";

const reply = (status, msg) => new Response(msg, { status, headers: { "Content-Type": "text/plain" } });

export function validSignature(body, signature, key, url) {
  if (!signature || !key || !url) return false;
  const expected = createHmac("sha256", key).update(url + body).digest("base64");
  const a = Buffer.from(expected), b = Buffer.from(String(signature));
  return a.length === b.length && timingSafeEqual(a, b);
}

// Set `sold: true` in an artwork file's front matter. Returns null if nothing changes.
export function markSoldInFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  let fm = m[1];
  if (/^sold:\s*true\s*$/m.test(fm)) return null;
  fm = /^sold:.*$/m.test(fm) ? fm.replace(/^sold:.*$/m, "sold: true") : fm + "\nsold: true";
  return text.replace(m[1], fm);
}

async function gh(path, init = {}) {
  const repo = process.env.GITHUB_REPO || "fzadso/pencilpusher-site";
  return fetch(`https://api.github.com/repos/${repo}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "pencilpusher-site",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

export async function markSold(id, title) {
  if (!/^[a-z0-9-]+$/.test(id)) return "skipped (bad id)";
  const branch = process.env.GITHUB_BRANCH || "main";
  const path = `contents/src/art/${id}.md`;
  const r = await gh(`${path}?ref=${branch}`);
  if (r.status === 404) return "skipped (piece not found)";
  if (!r.ok) throw new Error(`GitHub read ${r.status}`);
  const file = await r.json();
  const text = Buffer.from(file.content, "base64").toString("utf8");
  const updated = markSoldInFrontMatter(text);
  if (!updated) return "already sold";
  const w = await gh(path, {
    method: "PUT",
    body: JSON.stringify({
      message: `Mark “${title || id}” sold (Square sale)`,
      content: Buffer.from(updated, "utf8").toString("base64"),
      sha: file.sha,
      branch,
    }),
  });
  if (!w.ok) throw new Error(`GitHub write ${w.status}`);
  return "marked sold";
}

export default async (req) => {
  if (req.method !== "POST") return reply(405, "POST only");
  const body = await req.text();
  const url = process.env.SQUARE_WEBHOOK_URL || req.url;
  if (!validSignature(body, req.headers.get("x-square-hmacsha256-signature"), process.env.SQUARE_WEBHOOK_SIGNATURE_KEY, url)) {
    console.warn("square-webhook: bad or missing signature");
    return reply(403, "bad signature");
  }
  let event;
  try { event = JSON.parse(body); } catch { return reply(400, "bad json"); }

  const payment = event?.data?.object?.payment;
  if (!/^payment\.(updated|created)$/.test(event?.type || "") || !payment || payment.status !== "COMPLETED" || !payment.order_id) {
    return reply(200, "ignored");
  }

  const api = process.env.SQUARE_ENV === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
  const o = await fetch(`${api}/v2/orders/${encodeURIComponent(payment.order_id)}`, {
    headers: { Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`, "Square-Version": "2024-01-18" },
  });
  if (o.status === 404) return reply(200, "order not found (test event?)");
  if (!o.ok) { console.error("square-webhook: order lookup failed", o.status); return reply(502, "order lookup failed"); }
  const { order } = await o.json();

  const originals = (order?.line_items || []).filter(li => li.metadata?.kind === "original" && li.metadata?.art_id);
  const results = [];
  for (const li of originals) {
    try { results.push(`${li.metadata.art_id}: ${await markSold(li.metadata.art_id, li.name.replace(/ \(original\)$/, ""))}`); }
    catch (err) { console.error("square-webhook:", li.metadata.art_id, err.message); return reply(502, "update failed"); } // Square retries
  }
  console.log("square-webhook:", payment.order_id, results.join("; ") || "no originals");
  return reply(200, results.join("\n") || "no originals");
};
