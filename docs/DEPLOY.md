# Deploying Diana

Hosted setup: **Vercel** (web) + **Supabase Cloud** (database, auth). No always-on server is
needed until the worker arrives in Slice 3.

## 1. Supabase project

1. **Migrations.** With the cloud `DATABASE_URL` in `.env`, run `pnpm db:migrate`. It is
   idempotent. Never run `pnpm test` against this database: tests create and delete users.
2. **Email (needed for sign-in codes and for other people to sign up).** Supabase's built-in
   mailer cannot use custom templates, only delivers to members of your Supabase organisation,
   and sends a few emails per hour. Until custom SMTP is set up, sign-in still works for you
   through the emailed **link**, opened in the same browser that requested it.
   - Authentication → Emails → **SMTP Settings**: enable custom SMTP. Without a domain, Gmail
     works: host `smtp.gmail.com`, port `465`, username = your Gmail address, password = a Google
     [app password](https://myaccount.google.com/apppasswords) (needs 2-Step Verification).
     With a domain, use Resend or similar.
   - Then Authentication → Emails → **Templates**: for both **Magic Link** and **Confirm signup**,
     set the subject to `Your Diana sign-in code` and paste
     [`supabase/templates/sign_in.html`](../supabase/templates/sign_in.html). The template must
     contain `{{ .Token }}` for the code to appear.
3. **URLs** (after step 2 below gives you the domain). Authentication → URL Configuration:
   - Site URL: `https://<your-app>.vercel.app`
   - Redirect URLs: `https://<your-app>.vercel.app/auth/callback` and
     `http://localhost:3000/auth/callback`

## 2. Vercel project

1. Import the GitHub repo. Set **Root Directory** to `apps/web`.
2. Environment variables (Production and Preview):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Supabase → Connect → **Transaction pooler** URI (port **6543**) |
   | `DATABASE_POOL_MAX` | `3` |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API keys → publishable key |

3. Settings → Functions → **Function Region**: pick the region nearest the database.
4. Deploy. Every push to `main` redeploys.

`DATABASE_URL` is a privileged credential: it exists only in Vercel's server environment and is
never sent to browsers. User requests still run under RLS through `withUser()`.

## Known limits

- Free Supabase projects pause after about a week without activity; resume from the dashboard.
- Vercel's Hobby plan is for personal, non-commercial use.
