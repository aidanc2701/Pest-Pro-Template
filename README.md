# Pest Pro / Bird Control Utah Proposal Builder

A single-page proposal builder for both Pest Pro and Bird Control Utah. Fill
out client info, pricing, terms, and a guarantee, then export a branded PDF.
Saved proposals are shared with your whole team via a small database, so
anyone on the team can save, load, and track proposal status (draft / sent /
accepted / rejected).

## How this is hosted

- **The site itself** (`index.html`) is hosted for free on **Cloudflare
  Pages**, straight from this repo, live at
  [pest-pro-template.pages.dev](https://pest-pro-template.pages.dev). Push
  to `main` and it goes live automatically — no build step, no server to
  manage. (It used to be on GitHub Pages at a URL with a personal GitHub
  username in it; that's now disabled in favor of this one.)
- **Saved Proposals data** is stored in a free **Supabase** project (a
  hosted Postgres database with a built-in REST API). The page talks to it
  directly from the browser, but only once you're signed in — see
  `supabase-setup.sql` for the one-time setup.
- **Signing links** (the ones you send to clients) are handled by a small
  serverless function at `functions/api/proposal.js`, which Cloudflare Pages
  deploys automatically alongside the site — no separate hosting needed. It's
  the only part of the database a logged-out visitor can ever reach, and only
  one proposal at a time (see "Login and access control" below).

## One-time setup (only needs to happen once)

1. Create a free project at [supabase.com](https://supabase.com).
2. In your new project, go to **SQL Editor** → **New query**, paste the
   contents of `supabase-setup.sql`, and click **Run**.
3. Go to **Project Settings → API** and copy the **Project URL** and the
   **anon public** key.
4. Open `index.html` and near the top of the `<script>` tag, replace:
   ```js
   const SUPABASE_URL = 'REPLACE_WITH_SUPABASE_PROJECT_URL';
   const SUPABASE_ANON_KEY = 'REPLACE_WITH_SUPABASE_ANON_KEY';
   ```
   with your actual values.
5. Commit and push — the live site now has working Saved Proposals.

Until step 4 is done, the page shows a red banner at the top and the
Saved Proposals sidebar will show an error when you try to save/load. The
proposal builder itself (pricing, terms, PDF export) works fine either way.

## Login and access control

The editor and CRM are private now — anyone who opens the site's URL sees a
login screen, not your proposals. This closed a real gap: the app's public
key used to be enough on its own to read or edit everything in Saved
Proposals and the CRM (anyone who ever received a signing link could just
delete the `?view=...` part of the URL and land in your full database). Now
that key alone gets nothing — every request to the database has to come
from someone who's actually signed in.

Client Signing Links still work exactly as before and still need no login
— a client opening one is routed straight past the login screen. That flow
now goes through the serverless function (`functions/api/proposal.js`)
instead of talking to the database directly, and it can only ever reach
the one proposal the link points to, never the rest of your data.

**One-time setup, three steps — do these in order, since the site is
locked out of its own database until all three are done:**

1. **Create your login.** In the Supabase dashboard: **Authentication →
   Users → Add user**. Set an email + password and mark the email
   confirmed. That's the account you (and your team, if you want to share
   it) sign in with. There's no public sign-up page, by design — accounts
   are only ever created here, directly in the dashboard. Optionally, turn
   off **Authentication → Providers → Email → Allow new users to sign up**
   too, as a second layer against anyone else creating an account.
2. **Run the updated database rules.** SQL Editor → New query → paste the
   current contents of `supabase-setup.sql` → Run. (If you already ran an
   older version of this file, running it again is safe — it replaces the
   old "anyone with the key" rule with one that requires a signed-in user.)
3. **Add the service-role key to Cloudflare** — this is what lets the
   signing-link function reach the database without needing its own login.
   - Supabase: **Project Settings → API → service_role secret** → copy it.
   - Cloudflare Pages: open this project's dashboard → **Settings →
     Environment variables** → add a variable named
     `SUPABASE_SERVICE_ROLE_KEY` with that value, for **Production** (and
     Preview, if you want signing links to work on preview deployments
     too).
   - **Keep this one private** — unlike the anon key, it bypasses all
     database rules. Don't commit it to the repo or paste it into chat;
     Cloudflare's environment variables page is the only place it should
     ever live. A new deployment (the next `git push`, or "Retry
     deployment" in Cloudflare) is needed after adding it for the function
     to pick it up.

Until all three are done, the login screen won't let anyone in (no account
exists yet) and signing links will show an error (the function has no key
to work with yet) — so it's worth doing all three in one sitting rather
than leaving the site in between states.

## Email notification when a proposal is signed (optional)

By default you have to keep checking Saved Proposals to see if a client has
signed. Set this up once and you'll get an email the moment they submit their
signature, using a free **EmailJS** account (no backend server needed — the
page emails you directly, the same way it talks to Supabase).

1. Create a free account at [emailjs.com](https://www.emailjs.com).
2. **Email Services** → **Add New Service** → connect your Gmail (or
   whichever inbox you want to send from). Note the **Service ID** it gives
   you.
3. **Email Templates** → **Create New Template**. Set the **To Email** field
   (in the template's settings, not the body) to your own email address —
   that's what makes every notification land in your inbox regardless of who
   signs. Use these variables in the subject/body:
   - `{{property_name}}` — the property/company name on the proposal
   - `{{client_name}}` — the name they typed as their signature
   - `{{print_name}}` — the name they typed in the "Print Name" box (usually clearer than the signature script)
   - `{{signed_date}}` — the date they signed
   - `{{signing_link}}` — click it to jump straight to the signed proposal

   For example, subject: `Proposal signed: {{property_name}}`, body:
   `{{client_name}} signed on {{signed_date}}. View it: {{signing_link}}`

   Note the **Template ID**.
4. **Account → General** → copy your **Public Key**.
5. Open `index.html` and find:
   ```js
   const EMAILJS_PUBLIC_KEY = 'REPLACE_WITH_EMAILJS_PUBLIC_KEY';
   const EMAILJS_SERVICE_ID = 'REPLACE_WITH_EMAILJS_SERVICE_ID';
   const EMAILJS_TEMPLATE_ID = 'REPLACE_WITH_EMAILJS_TEMPLATE_ID';
   ```
   Replace all three with the values above.
6. Commit and push.

The free EmailJS plan covers 200 emails/month, far more than you'll need for
this. Until you fill these in, signing still works exactly the same — you
just won't get an email about it.

## Day-to-day workflow

You don't need to touch any of this yourself. Just tell Claude what you
want changed (wording, pricing defaults, a new job type, a design tweak,
anything), and Claude edits `index.html`, commits, and pushes. Cloudflare
Pages rebuilds automatically within about a minute, at the same URL —
no new link, ever.

## Assets

Logo and badge images live in `assets/`. If `assets/logo-bcu.png` (the
Bird Control Utah logo) is missing, the Bird Control Utah brand toggle
falls back to text-only branding until that file is added.

## Security note

The editor and CRM require a login (see "Login and access control" above)
and the database rejects any request that isn't signed in. The one
intentional exception is a client's Signing Link, which can only ever read
or sign the single proposal it points to — via the serverless function, not
direct database access — never anything else in your data. Signing links
themselves are still unauthenticated by design (a client shouldn't need an
account to sign one document), so anyone who gets hold of a specific link
can view and sign that one proposal; don't send links for proposals you
wouldn't want a stranger to be able to open.
