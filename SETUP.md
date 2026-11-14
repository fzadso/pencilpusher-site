# One-time setup (Cloudflare Pages)

The site is hosted free on **Cloudflare Pages**. Every change saved in `/admin` or pushed to GitHub rebuilds the site in a minute or two.

Do these in order. **Never paste passwords, tokens or keys into chat or email.** They only go into Cloudflare's or Netlify's settings pages. Menu names on these sites change now and then; if a label below doesn't match exactly, look for the closest one.

---

## 0. Freeze the old Netlify site (1 minute, do this first)
So the old site keeps working, unchanged, until the domain moves:
Netlify → the project → **Project configuration → Build & deploy → Continuous deployment → Stop builds**.

## 1. Create the Cloudflare site (about 10 minutes)
1. Sign up at **dash.cloudflare.com** (free plan).
2. **Workers & Pages → Create → Pages → Import an existing Git repository (Connect to Git)** → sign in with GitHub → allow access to **pencilpusher-site** only → select it.
3. Build settings:
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `_site`
4. **Save and Deploy.** When it finishes you get an address like `pencilpusher-site.pages.dev`. The pages work right away; checkout, the contact form and the editor login start working after the next steps.

## 2. Settings the site needs (about 15 minutes)
Cloudflare → your Pages project → **Settings → Variables and Secrets → Add** (for **Production**). Use type **Secret** for anything marked secret.

| Name | Value | Where it comes from |
|---|---|---|
| `SQUARE_ACCESS_TOKEN` (secret) | Square production access token | developer.squareup.com → the "Pencil Pusher website" app → Production → Credentials |
| `SQUARE_LOCATION_ID` | Square location ID | same app → Locations |
| `RESEND_API_KEY` (secret) | email-service key | step 3 below |
| `CONTACT_TO` | `Thepencilpusher123@gmail.com` | where contact and commission messages go |
| `GITHUB_OAUTH_CLIENT_ID` | editor login app ID | step 4 below |
| `GITHUB_OAUTH_CLIENT_SECRET` (secret) | editor login app secret | step 4 below |
| `GITHUB_TOKEN` (secret) | the "Pencil Pusher sold switch" token | step 5 below |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` (secret) | Square notification key | step 5 below |
| `SQUARE_WEBHOOK_URL` | `https://thepencilpusher.net/api/square-webhook` | step 5 below |

After adding or changing settings: **Deployments → … on the latest → Retry deployment** so they take effect.

## 3. Contact form email (about 5 minutes)
Messages from the Contact page and the Commissions request form are emailed **straight to Cindy**, with any photos attached. When she clicks Reply, the reply goes to the customer.
1. Sign up at **resend.com** using **Cindy's email, Thepencilpusher123@gmail.com** (free plan). Until the domain is verified (optional, below), Resend only delivers to the address the account was made with, so it has to be hers.
2. **API Keys → Create API key** (permission: Sending access) → copy it into Cloudflare as `RESEND_API_KEY`.
3. Optional, after step 6 (domain on Cloudflare): Resend → **Domains → Add domain** → `thepencilpusher.net` → let it add the DNS records in Cloudflare → then add the setting `CONTACT_FROM` = `The Pencil Pusher website <website@thepencilpusher.net>`. Mail is then less likely to land in Spam.
4. Test: send a message from the site's Contact page and check her inbox (and Spam the first time).
5. You can delete the Gmail forwarding filter from the Netlify days once the domain has moved.

## 4. Cindy's login to /admin (about 5 minutes)
1. GitHub → your picture → **Settings → Developer settings → OAuth Apps → New OAuth App**:
   - Application name: `Pencil Pusher editor`
   - Homepage URL: `https://thepencilpusher.net`
   - Authorization callback URL: `https://YOUR-PROJECT.pages.dev/api/callback` (your address from step 1).
     After the domain moves (step 6), change it to `https://thepencilpusher.net/api/callback`.
2. **Register**, then **Generate a new client secret**. Put the Client ID and secret into Cloudflare (step 2), and retry the deployment.
3. Test: open `https://YOUR-PROJECT.pages.dev/admin` → **Login with GitHub**.
4. Cindy keeps her own GitHub account and stays a collaborator on the repository. Nothing changes for her.

## 5. Mark originals Sold automatically (about 10 minutes)
When an original is paid for, the site switches it to Sold by itself (a minute or two later), so it can't be sold twice.
1. **GitHub key** (only lets the site edit this repository): GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**. Name `Pencil Pusher sold switch`, the longest expiration offered (calendar reminder to renew), **Only select repositories → pencilpusher-site**, **Contents: Read and write**. → Cloudflare `GITHUB_TOKEN`.
2. **Square notification:** developer.squareup.com → the website app → **Production → Webhooks → Subscriptions**. Add (or edit the existing) subscription:
   - URL: `https://thepencilpusher.net/api/square-webhook` (it starts working once the domain has moved)
   - Event: **payment.updated**
3. Copy its **Signature key** → Cloudflare `SQUARE_WEBHOOK_SIGNATURE_KEY`. Set `SQUARE_WEBHOOK_URL` to exactly the same URL as in Square. Retry the deployment.
4. After the domain moves, use Square's **Send test event**: it should show success (200).
5. If the GitHub key expires, sales still work; pieces just won't flip to Sold until you make a new key.

## 6. Move the domain to Cloudflare (Matt, about 15 minutes plus waiting)
1. Cloudflare → **Add a domain** (Add site) → `thepencilpusher.net` → **Free** plan. Cloudflare shows two **nameservers** (like `xxx.ns.cloudflare.com`).
2. Network Solutions → thepencilpusher.net → **Nameservers** → switch from the default ones to **custom** and enter Cloudflare's two. Save.
3. Wait until Cloudflare says the domain is **Active** (usually under an hour; up to a day).
4. Cloudflare → the Pages project → **Custom domains → Set up a custom domain** → `thepencilpusher.net`, then again for `www.thepencilpusher.net`. Cloudflare adds the records and https by itself.
5. Then: GitHub OAuth app callback → `https://thepencilpusher.net/api/callback` (step 4), and Square **Send test event** (step 5).
6. Optional, for **thepencilpusher.org**: add it to Cloudflare the same way, then **Rules → Redirect Rules** → redirect all requests to `https://thepencilpusher.net`.
7. Keep auto-renew on at Network Solutions for both domains (registration stays there; only the nameservers changed).
8. Once everything works on thepencilpusher.net, delete the old Netlify project.

## 7. Test everything once
- Home, Shop, a piece's page, Commissions, Contact load on `https://thepencilpusher.net`.
- Contact form message (with a photo) arrives in Cindy's inbox; Reply goes to the sender.
- `/admin` → Login with GitHub → edit a price → it shows on the site about 2 minutes later.
- Cart → **Checkout with Square** opens Square's payment page. One real $1 purchase, then refund it in Square.

## 8. Tell Google about the site (after the domain works)
1. **search.google.com/search-console** → add `thepencilpusher.net` (Cloudflare can add the verification record) → submit `https://thepencilpusher.net/sitemap.xml`.
2. Optional but very helpful for local searches: a free **Google Business Profile** for "The Pencil Pusher", as a service-area business in Boise (no street address shown), linking the website.
