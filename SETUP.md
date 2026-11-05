# One-time setup

Do these in order. Each step says who does it. **Never paste passwords, tokens or keys into chat or email.**

## 1. Put the site online (Netlify), about 10 minutes
1. Go to **netlify.com** → **Sign up** → **Sign up with GitHub**.
2. **Add new project → Import an existing project → GitHub** → choose **pencilpusher-site**.
3. The settings fill in from `netlify.toml` (build command `npm run build`, publish directory `_site`). Click **Deploy**.
4. When it finishes you get a link like `something.netlify.app`. Anyone can open it. To change it: **Project configuration → Change project name** → `pencilpusher`.

## 2. Contact form emails, about 3 minutes
1. In Netlify: **Forms** → **Enable form detection**, then redeploy (**Deploys → Trigger deploy → Deploy site**).
2. **Project configuration → Notifications → Emails and webhooks → Form submission notifications → Add notification → Email notification**.
   - Event: *New form submission*, Form: **contact**, Email: **your own Netlify account email** (the free plan only sends to the account owner).
3. Forward them to Cindy with Gmail (in the account that receives them): **Settings → Forwarding and POP/IMAP → Add a forwarding address →** `Thepencilpusher123@gmail.com` (she confirms the code), then create a **filter**: From = Netlify's form sender address, Subject contains `contact` → **Forward it to** `Thepencilpusher123@gmail.com`.
   - Send a test message from the Contact page and check that it reaches her (check Spam the first time).
4. Newsletter signups are under **Forms → newsletter** (Download as CSV).

## 3. Cindy's login to /admin, about 15 minutes
**a. Let the editor log in through GitHub (you, once):**
1. GitHub → your picture → **Settings → Developer settings → OAuth Apps → New OAuth App**.
   - Application name: `Pencil Pusher editor`
   - Homepage URL: `https://thepencilpusher.net` (or the netlify.app link for now)
   - Authorization callback URL: `https://api.netlify.com/auth/done`
2. Click **Register**, then **Generate a new client secret**. Keep this tab open.
3. Netlify → **Project configuration → Access & security → OAuth → Install provider → GitHub**. Paste the **Client ID** and **Client secret**. Save.

**b. Give Cindy access (you and Cindy):**
1. Cindy creates a free account at **github.com** (her email, a password she'll remember).
2. You: GitHub → **pencilpusher-site → Settings → Collaborators → Add people** → her username → **Write** access.
3. Cindy accepts the invitation from her email.
4. Cindy goes to `/admin` → **Login with GitHub**. Print **GUIDE-FOR-CINDY.md** for her.

## 4. Square checkout, about 20 minutes (Cindy, with you helping)
1. Cindy logs into **squareup.com** and confirms the account works and is linked to her bank.
2. Go to **developer.squareup.com** → sign in with the same Square login → **Applications → +** → name it `Pencil Pusher website`.
3. Open the app, switch the toggle at the top to **Production**, then go to **Credentials** and copy the **Production Access token**.
4. Open **Locations** (left menu) and copy the **Location ID**.
5. Netlify → **Project configuration → Environment variables → Add a variable**:
   - `SQUARE_ACCESS_TOKEN` = the access token (mark as secret)
   - `SQUARE_LOCATION_ID` = the location ID
6. **Deploys → Trigger deploy**.
7. **Test:** temporarily set a print price to $1 in /admin, buy it with a real card, then refund it in Square and set the price back.
   - To test without real money first, use the **Sandbox** token and location instead and add `SQUARE_ENV` = `sandbox`. Remove that variable when you switch to the production values.

## 4b. Mark originals Sold automatically (about 15 minutes)
When an original is paid for, the site switches it to Sold by itself (a minute or two later), so it can't be sold twice.

1. **A GitHub key for the site** (it only lets the site edit this one repository):
   GitHub → your picture → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Name: `Pencil Pusher sold switch`. Expiration: the longest offered (put a reminder in your calendar to renew it).
   - Repository access: **Only select repositories → pencilpusher-site**.
   - Permissions → Repository permissions → **Contents: Read and write**. Generate, and copy the token.
2. Netlify → **Project configuration → Environment variables**: add `GITHUB_TOKEN` = that token (secret).
3. **Tell Square to notify the site:** developer.squareup.com → the "Pencil Pusher website" app → make sure **Production** is selected → **Webhooks → Subscriptions → Add subscription**:
   - Name: `Mark sold`
   - URL: `https://zippy-wisp-907064.netlify.app/.netlify/functions/square-webhook`
     (keep this netlify.app address even after the real domain works; it never changes)
   - Events: **payment.updated**. Save.
4. Open the subscription and copy its **Signature key**. In Netlify add:
   - `SQUARE_WEBHOOK_SIGNATURE_KEY` = the signature key (secret)
   - `SQUARE_WEBHOOK_URL` = the exact URL from step 3
5. **Deploys → Trigger deploy**. Then in Square, on the subscription, click **Send test event**: it should show a success (200). The real proof is the next sale of an original: about 2 minutes after payment, the piece shows Sold.
6. If the GitHub key ever expires, sales still work; pieces just won't flip to Sold on their own until you make a new key and update `GITHUB_TOKEN`.

## 5. The domain (Matt, about 10 minutes plus waiting)
1. Netlify → **Domain management → Add a domain** → `thepencilpusher.net` → **Verify → Add domain**. Choose **Set up DNS externally**. Netlify shows the exact records; use those values.
2. Network Solutions → **My Domain Names → thepencilpusher.net → Manage → Advanced DNS (DNS records)**:
   - **A record**, host `@`: Netlify's load balancer IP (normally `75.2.60.5`). Delete any other A record for `@`.
   - **CNAME**, host `www`: your Netlify address, e.g. `pencilpusher.netlify.app`. Delete any other `www` record.
   - Leave **MX** (email) records alone.
3. Repeat for **thepencilpusher.org**, then in Netlify add it as a **domain alias** so it forwards to .net.
4. Wait up to a day. Netlify then turns on **https** by itself (Domain management → HTTPS shows "certificate active").
5. Make sure **auto-renew** is on for both domains at Network Solutions.

## 6. Tell Google about the site (after the domain works)
1. **search.google.com/search-console** → Add property → `thepencilpusher.net` → verify with the DNS record it gives you (Matt adds it at Network Solutions).
2. Submit the sitemap: `https://thepencilpusher.net/sitemap.xml`.
3. Optional but very helpful for local searches: create a free **Google Business Profile** for "The Pencil Pusher", set as a service-area business in Boise (no street address shown), and link the website.
