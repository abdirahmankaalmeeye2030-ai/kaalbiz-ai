# Connect KaalBiz to Supabase

KaalBiz keeps working with no Supabase project. Records stay on the phone and the header says **Cloud backup is off**. Accounts turn on only after both public keys below are set.

Do not put the `service_role` key in the app, in `NEXT_PUBLIC_` variables, or in git. This app does not use it.

## 1. Create the project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a project.
2. Wait until the database is ready.
3. Open **Project Settings → API**.
4. Copy **Project URL**. That is `NEXT_PUBLIC_SUPABASE_URL`.
5. Copy the **anon public** key. That is `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. Leave the **service_role** key on that page. Do not paste it into KaalBiz.

## 2. Run the migration

1. Open **SQL Editor → New query**.
2. Paste the whole file `supabase/migrations/20261124000000_accounts.sql`.
3. Run it.
4. Optional check: paste `supabase/tests/rls.sql` and confirm all six tables show `relrowsecurity = true`.

The migration creates `businesses`, `business_members`, `entries`, `contacts`, `staff`, and `goals`. Row level security lets a person read and write only a business they belong to. Only an owner can change members or delete the business.

## 3. Turn on email login

1. Open **Authentication → Providers** and enable **Email**.
2. Magic link (email OTP) is enough. Leave passwords off if you want.
3. Phone SMS can be added later in the same Auth area. The app sends people through `/auth/callback`, which stays the same if you add a phone later.

## 4. Allow these redirect URLs

Open **Authentication → URL configuration**.

**Site URL** for local work:

`http://localhost:38471`

**Redirect URLs** (add each one):

- `http://localhost:38471/auth/callback`
- `http://127.0.0.1:38471/auth/callback`
- `https://kaalbiz-ai-business.vercel.app/auth/callback`
- Each Vercel preview you use, for example `https://kaalbiz-ai-business-git-feature-accounts-cloud-kaal2.vercel.app/auth/callback`

Supabase does not accept a wildcard for every preview. When you open a new preview, copy its `https://…vercel.app/auth/callback` address into this list.

## 5. Local env

In the project folder:

```bash
cp .env.example .env.local
```

Set:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

Restart `npm run dev`. Sign in at [http://localhost:38471/sign-in](http://localhost:38471/sign-in).

## 6. Vercel Preview only, for now

1. Vercel → the KaalBiz project → **Settings → Environment Variables**.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Tick **Preview** only. Leave Production unchecked until you want the judged link to use accounts.
4. Redeploy the preview branch.

## 7. What you should see

- No keys: header says **Cloud backup is off**. AI routes stay open, as they are today.
- Keys set, signed out: **Sign in**. AI routes answer `Sign in to use KaalBiz AI.`
- First login: KaalBiz asks for the shop name, then **Upload the records on this phone to your account?**
- After that, the header shows **Backed up ✓**, **Syncing…**, or **Offline, will sync later**, plus the last synced time.

Login emails are limited to 5 tries each 10 minutes per address path on one server instance. Supabase has its own limit as well.
