// Small helpers shared by the Cloudflare Pages Functions (standard Web APIs only).

export const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export const text = (status, body) => new Response(body, { status, headers: { "Content-Type": "text/plain" } });

const enc = new TextEncoder();

export function bytesToBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export const utf8ToBase64 = str => bytesToBase64(enc.encode(str));
export function base64ToUtf8(b64) {
  const bin = atob(String(b64).replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export async function hmacSha256Base64(key, message) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToBase64(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(message))));
}

export function safeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export const squareApi = env => env.SQUARE_ENV === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";

export const escapeHtml = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Read a published file of this site (e.g. /products.json) from inside a Function.
export async function siteFile(request, env, path) {
  const url = new URL(path, request.url);
  const r = env.ASSETS ? await env.ASSETS.fetch(new Request(url)) : await fetch(url);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r;
}
