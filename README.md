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
  directly from the browser using a public "anon" key — see
  `supabase-setup.sql` for the one-time setup.

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

There's no login system on this site or on the Supabase table — it's
built around the same "anyone with the link" trust model as the original
template. Don't store anything more sensitive than proposal drafts in
Saved Proposals.
