// GET /api/callback — GitHub returns here after Cindy approves the login.
// Swaps the one-time code for a token and hands it to the /admin window that opened this popup,
// using Decap CMS's standard popup handshake. The token is only given to this site's own pages.
import { escapeHtml } from "../../lib/util.js";

function page(status, origin, message, ok) {
  const msg = JSON.stringify(`authorization:github:${ok ? "success" : "error"}:${JSON.stringify(message)}`);
  return new Response(`<!doctype html><meta charset="utf-8"><title>Logging in…</title>
<p style="font:16px Arial,sans-serif;padding:24px">${ok ? "Logging you in…" : "Login didn't work: " + escapeHtml(message.message || "")}</p>
<script>
(function () {
  var origin = ${JSON.stringify(origin)};
  function receive(e) {
    if (e.origin !== origin) return;
    window.opener.postMessage(${msg}, origin);
    window.removeEventListener("message", receive, false);
  }
  window.addEventListener("message", receive, false);
  if (window.opener) window.opener.postMessage("authorizing:github", origin);
})();
</script>`, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Set-Cookie": "pp_oauth_state=; Path=/api/; Max-Age=0; HttpOnly; Secure; SameSite=Lax" } });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)pp_oauth_state=([^;]+)/);
  if (!code || !state || !cookie || cookie[1] !== state) return page(400, origin, { message: "The login link expired. Close this window and click Login again." }, false);
  if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET) return page(503, origin, { message: "Login isn't set up yet." }, false);

  const r = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "pencilpusher-site" },
    body: JSON.stringify({ client_id: env.GITHUB_OAUTH_CLIENT_ID, client_secret: env.GITHUB_OAUTH_CLIENT_SECRET, code, redirect_uri: `${origin}/api/callback` }),
  }).catch(() => null);
  const data = r ? await r.json().catch(() => ({})) : {};
  if (!data.access_token) {
    console.error("oauth callback:", r && r.status, data.error, data.error_description);
    return page(502, origin, { message: data.error_description || "GitHub didn't accept the login." }, false);
  }
  return page(200, origin, { token: data.access_token, provider: "github" }, true);
}
