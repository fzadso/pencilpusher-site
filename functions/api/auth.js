// GET /api/auth — first step of Cindy's "Login with GitHub" on the /admin editor (Decap CMS).
// Sends her to GitHub to approve, which then returns to /api/callback.
//
// Variables and Secrets: GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_CLIENT_SECRET (secret)
// (from a GitHub OAuth App whose callback URL is https://<this site>/api/callback)
export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_OAUTH_CLIENT_ID) return new Response("Login isn't set up yet (GITHUB_OAUTH_CLIENT_ID is missing).", { status: 503 });
  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const scope = /^[\w:, ]{1,80}$/.test(url.searchParams.get("scope") || "") ? url.searchParams.get("scope") : "repo,user";
  const gh = new URL("https://github.com/login/oauth/authorize");
  gh.searchParams.set("client_id", env.GITHUB_OAUTH_CLIENT_ID);
  gh.searchParams.set("redirect_uri", `${url.origin}/api/callback`);
  gh.searchParams.set("scope", scope);
  gh.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: gh.toString(),
      "Set-Cookie": `pp_oauth_state=${state}; Path=/api/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
      "Cache-Control": "no-store",
    },
  });
}
