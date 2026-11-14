// POST /api/square-webhook — marks an original "Sold" after Square reports a completed payment.
// Square → (signature checked) → look up the order → for each line item tagged kind=original
// (added by checkout.js) set `sold: true` in src/art/<id>.md on GitHub → site rebuilds.
//
// Variables and Secrets:
//   SQUARE_ACCESS_TOKEN, SQUARE_ENV (optional)
//   SQUARE_WEBHOOK_SIGNATURE_KEY (secret) and SQUARE_WEBHOOK_URL (the exact URL entered in Square)
//   GITHUB_TOKEN (secret; fine-grained, Contents read & write on this repo only)
//   GITHUB_REPO (optional, default fzadso/pencilpusher-site), GITHUB_BRANCH (optional, default main)
import { text, hmacSha256Base64, safeEqual, squareApi, utf8ToBase64, base64ToUtf8 } from "../../lib/util.js";

export async function validSignature(body, signature, key, url) {
  if (!signature || !key || !url) return false;
  return safeEqual(await hmacSha256Base64(key, url + body), signature);
}

// Set `sold: true` in an artwork file's front matter. Returns null if nothing changes.
export function markSoldInFrontMatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  let fm = m[1];
  if (/^sold:\s*true\s*$/m.test(fm)) return null;
  fm = /^sold:.*$/m.test(fm) ? fm.replace(/^sold:.*$/m, "sold: true") : fm + "\nsold: true";
  return md.replace(m[1], fm);
}

function gh(env, path, init = {}) {
  const repo = env.GITHUB_REPO || "fzadso/pencilpusher-site";
  return fetch(`https://api.github.com/repos/${repo}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "pencilpusher-site",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

export async function markSold(env, id, title) {
  if (!/^[a-z0-9-]+$/.test(id)) return "skipped (bad id)";
  const branch = env.GITHUB_BRANCH || "main";
  const path = `contents/src/art/${id}.md`;
  const r = await gh(env, `${path}?ref=${branch}`);
  if (r.status === 404) return "skipped (piece not found)";
  if (!r.ok) throw new Error(`GitHub read ${r.status}`);
  const file = await r.json();
  const updated = markSoldInFrontMatter(base64ToUtf8(file.content));
  if (!updated) return "already sold";
  const w = await gh(env, path, {
    method: "PUT",
    body: JSON.stringify({ message: `Mark “${title || id}” sold (Square sale)`, content: utf8ToBase64(updated), sha: file.sha, branch }),
  });
  if (!w.ok) throw new Error(`GitHub write ${w.status}`);
  return "marked sold";
}

export async function onRequestPost({ request, env }) {
  const body = await request.text();
  const url = env.SQUARE_WEBHOOK_URL || request.url;
  if (!(await validSignature(body, request.headers.get("x-square-hmacsha256-signature"), env.SQUARE_WEBHOOK_SIGNATURE_KEY, url))) {
    console.warn("square-webhook: bad or missing signature");
    return text(403, "bad signature");
  }
  let event;
  try { event = JSON.parse(body); } catch { return text(400, "bad json"); }

  const payment = event?.data?.object?.payment;
  if (!/^payment\.(updated|created)$/.test(event?.type || "") || !payment || payment.status !== "COMPLETED" || !payment.order_id) {
    return text(200, "ignored");
  }

  let o;
  try {
    o = await fetch(`${squareApi(env)}/v2/orders/${encodeURIComponent(payment.order_id)}`, {
      headers: { Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`, "Square-Version": "2024-01-18" },
    });
  } catch (err) { console.error("square-webhook: Square unreachable", err.message); return text(502, "Square unreachable"); } // Square retries
  if (o.status === 404) return text(200, "order not found (test event?)");
  if (!o.ok) { console.error("square-webhook: order lookup failed", o.status); return text(502, "order lookup failed"); }
  const { order } = await o.json();

  const originals = (order?.line_items || []).filter(li => li.metadata?.kind === "original" && li.metadata?.art_id);
  const results = [];
  for (const li of originals) {
    try { results.push(`${li.metadata.art_id}: ${await markSold(env, li.metadata.art_id, li.name.replace(/ \(original\)$/, ""))}`); }
    catch (err) { console.error("square-webhook:", li.metadata.art_id, err.message); return text(502, "update failed"); } // Square retries
  }
  console.log("square-webhook:", payment.order_id, results.join("; ") || "no originals");
  return text(200, results.join("\n") || "no originals");
}
