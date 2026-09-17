# MTT Opportunity ID Generator

A small internal web app for Masenang Tours & Travel (MTT) that generates a
unique, sequential **Opportunity ID** for every genuine sales opportunity,
and keeps a permanent audit register of every ID ever issued.

The generated ID (e.g. `MTT26-000123`) is combined with a short description
and copied into Odoo's Opportunity Name field. This app does **not** replace
Odoo — Odoo remains the CRM. This app only issues IDs and keeps the audit
trail.

```
MTT26-000123 | 4 Days 3 Nights Kundasang and Kota Kinabalu Tour
```

---

## 1. What this app does

- Consultants log in with their own email/password.
- They type an Opportunity Description and click **Generate ID**.
- The database (never the browser) issues the next sequential ID for the
  current calendar year, in the format `MTTYY-XXXXXX`.
- The app shows the combined "ID | Description" string with a **Copy for
  Odoo** button.
- Everyone can see and search the register of IDs already issued.
- Admins can void a record (with a mandatory reason) and export the whole
  register to CSV. Nothing is ever deleted, and no ID or sequence number is
  ever reused, even if voided.

## 2. Architecture

```
GitHub Repository
      |
GitHub Pages  (static index.html / app.js / style.css - no build step)
      |
Supabase Free (cloud)
      +-- Authentication   (email/password logins, created by an admin)
      +-- PostgreSQL       (profiles, opportunities, opportunity_sequences)
      +-- SQL functions    (generate_opportunity_id, void_opportunity)
      +-- Row Level Security (enforces every permission rule above)
```

There is no separate backend server, no Docker, no Vercel/Netlify. The
browser talks directly to Supabase using its JavaScript SDK, loaded from a
public CDN. Everything you need is: this repository, GitHub Pages, and a
free Supabase project.

### Why is this safe without a backend server?

Supabase gives the browser a public **anon key**. That key alone cannot
read or change anything — every table has **Row Level Security (RLS)**
turned on, and IDs are only ever created or voided through two special
SQL functions that check permissions themselves. See section 9 for exactly
how.

## 3. Files in this repository

| File | Purpose |
|---|---|
| `index.html` | The whole page (login screen + main app) |
| `style.css` | Plain, minimal styling |
| `app.js` | All app logic (login, generate, search, void, CSV export) |
| `config.js` | Your Supabase Project URL and anon key (safe to commit — see section 8) |
| `supabase/schema.sql` | The complete database setup — tables, functions, RLS. Run this once in Supabase |

## 4. Setting up your Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (create a free
   account if you don't have one).
2. Click **New Project**.
3. Enter a project name, e.g. `mtt-opportunity-id`.
4. Set a database password (save it somewhere safe — you generally won't
   need it day-to-day since the app doesn't use it directly).
5. Choose a region close to Malaysia (e.g. Singapore) and click **Create
   new project**. Wait a minute or two while it provisions.

### Get your API values

1. In your Supabase project, click the **gear icon (Project Settings)** in
   the left sidebar.
2. Click **API**.
3. Copy the **Project URL**.
4. Copy the key labelled **anon** / **public** (NOT `service_role`).

### Put them into this repository

1. Open `config.js` in this repository.
2. Replace `YOUR-PROJECT-REF.supabase.co` with your Project URL.
3. Replace `YOUR-ANON-PUBLIC-KEY` with the anon/public key you copied.
4. Save the file.

## 5. Running the SQL setup

1. In your Supabase project, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `supabase/schema.sql` from this repository, copy its entire
   contents, and paste it into the SQL Editor.
4. Click **Run**.
5. Expected result: a green success message ("Success. No rows returned").
   If you see a red error, read it carefully — it usually means the file
   was only partly pasted.

This creates:
- `profiles`, `opportunities`, `opportunity_sequences` tables
- The `generate_opportunity_id()` and `void_opportunity()` functions
- All Row Level Security policies

## 6. Configuring Authentication

1. In Supabase, click **Authentication** in the left sidebar.
2. Click **Providers**, confirm **Email** is enabled (it is by default).
3. Click **Settings** (under Authentication), and turn **OFF** "Allow new
   users to sign up" (sometimes labelled "Enable email signups" or found
   under **Auth > Sign In / Providers**, depending on your Supabase
   version). We want an admin to create every login manually — there is
   no public registration page in this app.
4. Under **Settings**, you can also turn off "Confirm email" if you don't
   want new users to have to click a confirmation email before their
   first login (optional, your choice).

## 7. Creating users

### Create a login (do this for every consultant and admin)

1. In Supabase, go to **Authentication -> Users**.
2. Click **Add user** -> **Create new user**.
3. Enter their email and a temporary password. Untick "Auto Confirm User"
   only if you want them to confirm by email; otherwise tick it so they
   can log in immediately.
4. Click **Create user**.

As soon as the user is created, a matching row is automatically added to
the `profiles` table (full name defaults to their email, role defaults to
`consultant`, active = true). You can give them a nicer display name and
promote them to admin using the SQL below.

### Set a user's display name

In **SQL Editor**, run (replace the email):

```sql
update public.profiles
set full_name = 'Felicia Tan'
where id = (select id from auth.users where email = 'felicia@example.com');
```

### Promote a user to admin

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@example.com');
```

### Deactivate a user (blocks them from generating IDs, without deleting history)

```sql
update public.profiles
set active = false
where id = (select id from auth.users where email = 'someone@example.com');
```

Expected result each time: "Success. 1 rows affected" (or similar) at the
bottom of the SQL Editor.

## 8. Which values are safe to share, and which are secret

| Value | Where it's used | Safe to commit to GitHub? |
|---|---|---|
| Project URL | `config.js` | Yes |
| `anon` / `public` key | `config.js` | Yes — protected by RLS, designed for browsers |
| `service_role` key | Never used by this app | **NO — never put this anywhere in this repo** |
| Database password | Never used by this app | **NO — never put this anywhere in this repo** |

The anon key lets the browser *ask* Supabase to do things, but Row Level
Security (set up by `schema.sql`) decides what it's actually allowed to
do. That is why it's safe to publish on GitHub Pages, unlike the
`service_role` key, which bypasses all security rules.

## 9. How the numbering stays safe (no duplicate IDs)

The browser never calculates the next number. Instead, clicking **Generate
ID** calls a database function, `generate_opportunity_id()`, which:

1. Checks the caller is logged in and active.
2. Runs one atomic SQL statement that increments a per-year counter row:
   ```sql
   insert into opportunity_sequences (sequence_year, last_number)
   values (2026, 1)
   on conflict (sequence_year)
   do update set last_number = opportunity_sequences.last_number + 1
   returning last_number;
   ```
   Postgres locks that counter row for the brief moment this statement
   runs. If two consultants click Generate at the same instant, Postgres
   processes them one after another — they can never receive the same
   number.
3. Builds the ID as `MTT` + two-digit year + `-` + the number padded to 6
   digits, e.g. `MTT26-000123`.
4. Inserts the new record into the `opportunities` table.

A `UNIQUE` constraint on the ID column, and another on
`(sequence_year, sequence_number)`, is a second safety net that would
reject any accidental duplicate outright.

Because the year is read from the current date automatically, the
sequence naturally starts again at `000001` on 1 January each year — there
is no scheduled job needed.

Voided records keep their number forever, so numbers are never reused.

## 10. Row Level Security — what each rule means

- **profiles**: you can only see your own profile, unless you're an
  admin (admins can see everyone's).
- **opportunities — read**: any logged-in user can see every record. This
  is a shared register, not private to each consultant.
- **opportunities — create/edit/delete**: nobody, not even admins, can
  insert, edit, or delete rows in this table directly. The *only* way a
  row can be created is through `generate_opportunity_id()`, and the
  *only* way its status can change to Void is through
  `void_opportunity()` — both check permissions themselves and are the
  single door through which the table can be written to. This is what
  makes generated IDs immutable and tamper-resistant at the database
  level.
- **opportunity_sequences**: nobody can read or write this table directly
  from the browser, ever.
- **Logged-out visitors**: have no policies granting them anything, so
  they cannot read or write any business data.

## 11. Local development

You don't need Node.js, npm, or a build step — this is plain HTML/CSS/JS.

1. Make sure `config.js` has your real Supabase URL and anon key (section
   4).
2. From the project folder, start any simple local web server, for
   example:
   ```bash
   python3 -m http.server 8000
   ```
3. Open `http://localhost:8000` in your browser.

(Opening `index.html` directly with `file://` will not work correctly
because the browser blocks ES module imports over `file://`.)

## 12. Deploying to GitHub Pages

1. Push this repository to GitHub (with your real `config.js` values
   committed — see section 8 for why that's safe).
2. In the GitHub repository, go to **Settings -> Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a
   branch".
4. Choose your branch (e.g. `main`) and folder `/ (root)`, then **Save**.
5. Wait a minute, then GitHub shows the live URL (something like
   `https://yourname.github.io/mtt-trip-id-generator/`).

Any time you push a new commit to that branch, GitHub Pages redeploys
automatically.

## 13. How to use the application

1. Open the app's URL and log in with your email and password.
2. Type a description of the opportunity, e.g. "4 Days 3 Nights Kundasang
   and Kota Kinabalu Tour".
3. Click **Generate ID**. The button disables itself while working, so
   you can't accidentally create two IDs by double-clicking.
4. The generated ID and the combined "ID | Description" string appear.
5. Click **Copy for Odoo**, then paste that text into Odoo's Opportunity
   Name field.
6. Use the search box under "Recent Opportunity IDs" to find a record by
   ID, description, or the name of the person who created it.

## 14. How to void a record (admin only)

1. Log in as an admin.
2. Find the record in the table and click its **Void** button.
3. Enter a reason (required) and click **Confirm Void**.
4. The record now shows status "Void" with the reason next to it. It
   remains in the register permanently, and its ID/number will never be
   reused.

## 15. How to export the register to CSV (admin only)

1. Log in as an admin.
2. Click **Export CSV** near the top of the page.
3. Your browser downloads a file named like
   `mtt-opportunity-register-2026-09-17.csv`, containing every record
   (Active and Void) with all audit fields.

## 16. Troubleshooting

**"Your account is not active. Contact your administrator."**
Your `profiles.active` value is `false`, or your profile row wasn't
created. Check with `select * from public.profiles;` in the SQL Editor.

**Login succeeds but the page seems stuck / blank main screen.**
Open the browser console (F12) and look for an error. A common cause is
`config.js` still containing the placeholder URL/key — double check
section 4.

**"Failed to generate Opportunity ID: User account is not active"**
Same as above — an admin needs to set `active = true` for that user.

**Clicking Generate does nothing / shows a permissions error.**
Make sure `supabase/schema.sql` ran successfully and without errors —
especially the `grant execute ...` statements near the bottom.

**I want to let a consultant sign up themselves.**
Don't — this app is designed around admin-created accounts only, per the
business requirement that individual identity must be trustworthy for
the audit trail. Signups are disabled deliberately (section 6).

**Two people generated an ID within the same second — did one get lost?**
No. See section 9 — the database serializes concurrent requests, so both
get distinct, correct numbers.

## 17. Security notes

- Never put the `service_role` key or your database password in any file
  in this repository.
- The `.gitignore` file excludes `.env` files in case you add
  environment-specific secrets later, though this app currently needs
  none beyond the public values in `config.js`.
- All real security enforcement (who can read what, who can write what)
  lives in Supabase's Row Level Security policies and the two SQL
  functions — not in the JavaScript code. Even if someone bypassed the
  UI entirely and called the Supabase API directly, the same rules apply.

## 18. Out of scope for this version

This app intentionally does **not** include CRM features, quotation or
costing tools, supplier/invoice management, or profitability dashboards.
It only generates controlled IDs and maintains their audit register.
Future integration with the Monthly Statistic Report may be added later.
