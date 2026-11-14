# The Pencil Pusher

Website for Cindy Smith, pencil and acrylic artist in Boise, Idaho: **thepencilpusher.net**

- **Cindy:** read [GUIDE-FOR-CINDY.md](GUIDE-FOR-CINDY.md). Everything you need is at thepencilpusher.net/admin.
- **Setting it up (one time):** follow [SETUP.md](SETUP.md).

## How it's built
- [Eleventy](https://www.11ty.dev/) turns the files in `src/` into the website. Photos are resized automatically at build time.
- [Decap CMS](https://decapcms.org/) at `/admin` edits the files in `src/art/` (one file per artwork) and `src/_data/` (About, Commissions, settings).
- Hosted free on **Cloudflare Pages**. Small server pieces live in `functions/api/` (Cloudflare Pages Functions):
  - `checkout.js` turns the cart into a Square checkout page. Prices come from the published `products.json`, never from the browser.
  - `square-webhook.js` marks an original Sold on GitHub after Square reports a completed payment.
  - `contact.js` emails contact/commission messages (with photos) to Cindy through Resend.
  - `auth.js` + `callback.js` are the GitHub login for the `/admin` editor.
- Shared helpers are in `lib/`. Settings and keys are Cloudflare "Variables and Secrets" (see SETUP.md).

## Working on it locally
```bash
npm install
npm start
```
Then open http://localhost:8080. To run the functions too: `npm run build`, then `npx wrangler pages dev _site` with test values in a `.dev.vars` file (never real keys in the repository).
