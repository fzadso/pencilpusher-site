# The Pencil Pusher

Website for Cindy Smith, pencil and acrylic artist in Boise, Idaho: **thepencilpusher.net**

- **Cindy:** read [GUIDE-FOR-CINDY.md](GUIDE-FOR-CINDY.md). Everything you need is at thepencilpusher.net/admin.
- **Setting it up (one time):** follow [SETUP.md](SETUP.md).

## How it's built
- [Eleventy](https://www.11ty.dev/) turns the files in `src/` into the website. Photos are resized automatically at build time.
- [Decap CMS](https://decapcms.org/) at `/admin` edits the files in `src/art/` (one file per artwork) and `src/_data/` (About, Commissions, settings).
- Hosted free on Netlify. Netlify Forms handles the contact form and newsletter signups.
- `netlify/functions/checkout.mjs` turns the cart into a Square checkout page. Prices come from the live site, never from the browser.

## Working on it locally
```bash
npm install
npm start
```
Then open http://localhost:8080.
