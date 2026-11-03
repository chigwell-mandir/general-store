# General Store — check-in / check-out

A phone-friendly web app for the mandir General Store desk: issue and return kit,
confirmed kit per volunteer, live outstanding list, WhatsApp escalation per zone lead,
on-the-day check-in and ID cards, stock counts, and a full audit log.

- **App:** React + Vite, hosted free on **GitHub Pages**
- **Data:** **Supabase** (Postgres + live updates + login), free plan
- **Keep-alive:** a GitHub scheduled job pings Supabase every 3 days so it never pauses

With no Supabase settings the app runs in **demo mode**: sample data, stored only in
that browser. That is how to try it before anything is set up.

---

## Run it on this Mac

Needs Node 20 or newer (`node -v`).

```bash
cd "/Users/jayamin/Downloads/Apps:Websites/Chigwell Diwali Inventory App"
npm install      # first time only
npm run dev
```

Open **http://localhost:5173**. To try it on a phone on the same wifi, use the
`Network:` address `npm run dev` prints (e.g. `http://192.168.1.20:5173`).

> The folder name contains a colon (`Apps:Websites`), which breaks npm's usual tool
> lookup, so the scripts in `package.json` call Vite and TypeScript by path. Use the
> `npm run …` commands above rather than `npx vite`.

---

## One-time setup to go live

### 1. Supabase (the database)

1. Sign in at **supabase.com** → **New project**. Name it e.g. `general-store`, choose
   region **London (eu-west-2)**, set a database password (save it somewhere safe).
2. When it's ready: **SQL Editor → New query**, paste the whole of
   [`supabase/schema.sql`](supabase/schema.sql), click **Run**. You should see “Success”.
3. **Authentication → Sign In / Providers → User Signups**: turn **off** “Allow new users to
   sign up” if you can find it. (Not essential: the data is locked to the emails listed in the
   `allowed_logins` table either way — see step 4.)
4. **Authentication → Users → Add user → Create new user**: email e.g.
   `store-desk@yourdomain` (it doesn’t need to be a real inbox), a strong password,
   tick **Auto confirm user**. This password is what desk volunteers type to sign in.
   Then in **SQL Editor** run (with your desk email, in lower case):
   `insert into allowed_logins (email) values ('store-desk@yourdomain');`
   Only emails in that table can see or change any data.
5. **Project Settings → API**: copy the **Project URL** and the **anon / publishable key**.

### 2. Try it locally against the real database (optional)

Create `.env.local` in the project folder (it is git-ignored):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_DESK_EMAIL=store-desk@yourdomain
```

Restart `npm run dev`. You’ll now see the desk sign-in screen instead of demo mode.
Then in the app: **More → Setup** → *Add starter catalogue*, add zone leads, import the
mastersheet.

### 3. GitHub (hosting)

1. On **github.com → New repository**, name e.g. `general-store`, **Public**
   (free GitHub Pages needs public; no volunteer data is ever in the code —
   `.gitignore` blocks `.xlsx` / `.csv` / `.env.local`).
2. **Settings → Secrets and variables → Actions → New repository secret**, add three:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DESK_EMAIL` (same values as above).
3. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Push this folder to the repo’s `main` branch. The **Deploy to GitHub Pages** action
   builds and publishes it; the address is shown under **Settings → Pages**, e.g.
   `https://<your-username>.github.io/general-store/`.
5. **Actions → Keep database awake → Run workflow** once to check the ping works.

On phones, open the link and use **Share → Add to Home Screen** for an app icon.

---

## On the day

- Each desk phone/laptop: open the link, enter the desk password once, tap your name.
- **Issue**: search the person → tap their confirmed kit, or pick any other item.
- **Return**: search the person (or type a walkie WT number) → **Return**.
- **Out**: everything still out; red after the overdue time (Setup → Event).
- **More → Escalation**: copy the per-zone-lead summary into WhatsApp.
- **More → Setup → Download Excel backup** at the end of each day.

Mistakes: every issued line has **⋯ → Cancel this issue**, which puts the stock back
and is still recorded in History.

---

## Where things live

| Path | What |
|---|---|
| `supabase/schema.sql` | Tables, security rules, and the stock functions (atomic issue/return) |
| `src/lib/backend/` | Supabase backend + demo (in-browser) backend, same interface |
| `src/lib/store.tsx` | App-wide data, live updates, all actions |
| `src/lib/importers.ts` | Mastersheet / stock import and Excel export |
| `src/lib/search.ts` | myBAPS-style person search (SID exact, name fuzzy) |
| `src/pages/` | One file per screen |
| `src/styles.css` | Design tokens (colours, spacing) and all styles |

Multi-event later: every event table already has `event_id` (always `1` today).
