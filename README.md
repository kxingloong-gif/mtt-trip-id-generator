# MTT Trip ID Generator

A small internal web app for Masenang Tours & Travel (MTT) that generates a
unique, sequential, and permanent **Trip ID** (also called an Opportunity
ID) for every confirmed trip, and keeps a permanent audit register of every
ID ever issued — including every proposed change to it and who approved or
rejected that change.

The generated ID (e.g. `M2600001`) is combined with a short description and
copied into Odoo's Opportunity Name field. This app does **not** replace
Odoo — Odoo remains the CRM. This app only issues IDs, runs a controlled
amendment/void approval workflow, and keeps the audit trail.

```
M2600001 | 4 Days 3 Nights Kundasang and Kota Kinabalu Tour
```

The Trip ID itself (`M2600001`) is always exactly **8 characters**, with no
hyphens, spaces, or other punctuation, so it fits an internal system that
only accepts an 8-character reference. The `|` separator and description
are part of the combined "Odoo Opportunity Name" only — never part of the
ID itself. **The Trip ID never changes, is never reused, and is never
deleted, no matter what happens to the description or the booking.**

For how Consultants and Supervisors actually use the app day-to-day
(including when to generate a Trip ID, how to request an amendment, and
the difference between Cancelled and Void), see
**[CONSULTANT_SUPERVISOR_MANUAL.md](CONSULTANT_SUPERVISOR_MANUAL.md)**.
This README is the technical/admin document.

---

## 1. What this app does

- Users log in with their own email/password as a **Consultant**,
  **Supervisor**, or **Admin**.
- A Consultant types a Trip Description and clicks **Generate ID** — the
  normal trigger for this is a deposit being received (see the user
  manual). The database (never the browser) issues the next sequential ID
  for the current calendar year, in the format `MYYNNNNN` (8 characters:
  `M` + a 2-digit year + a 5-digit sequence).
- The app shows the combined "ID | Description" string with a **Copy for
  Odoo** button.
- Everyone can see and search the register of IDs already issued.
- The description can later be corrected through a **Request Amendment**
  workflow: a Consultant (or Supervisor, for their own record) proposes a
  new description with a reason; a Supervisor or Admin must approve it
  before it takes effect. The Trip ID itself never changes.
- A record created in error can be corrected through the same kind of
  **Request Void** workflow, again requiring Supervisor/Admin approval.
- A genuine booking that the customer later cancels is marked
  **Cancelled** by a Supervisor or Admin directly — kept clearly distinct
  from **Void** (which means the ID should never have existed at all).
- Admins can still void a record directly and immediately, as in the
  original version of this app, and can export the register (and the full
  amendment/void history) to CSV. Nothing is ever deleted, and no ID or
  sequence number is ever reused.

## 2. Architecture

```
GitHub Repository
      |
GitHub Pages  (static index.html / app.js / style.css - no build step)
      |
Supabase Free (cloud)
      +-- Authentication   (email/password logins, created by an admin)
      +-- PostgreSQL       (profiles, opportunities, opportunity_sequences,
      |                     opportunity_requests)
      +-- SQL functions    (generate_opportunity_id, void_opportunity,
      |                     request_amendment, request_void,
      |                     review_request, cancel_opportunity)
      +-- Row Level Security (enforces every permission rule above)
```

There is no separate backend server, no Docker, no Vercel/Netlify. The
browser talks directly to Supabase using its JavaScript SDK, loaded from a
public CDN. Everything you need is: this repository, GitHub Pages, and a
free Supabase project.

### Why is this safe without a backend server?

Supabase gives the browser a public **anon key**. That key alone cannot
read or change anything — every table has **Row Level Security (RLS)**
turned on, and every write to a Trip ID record goes through one of the SQL
functions listed above, each of which checks permissions itself. See
section 9 (numbering) and section 11 (amendment/void workflow) for exactly
how.

## 3. Files in this repository

| File | Purpose |
|---|---|
| `index.html` | The whole page (login screen + main app) |
| `style.css` | Plain, minimal styling |
| `app.js` | All app logic (login, generate, amend/void requests, approvals, cancel, search, CSV export) |
| `config.js` | Your Supabase Project URL and anon key (safe to commit — see section 8) |
| `supabase/schema.sql` | The complete database setup — tables, functions, RLS. Safely re-runnable; run this in Supabase every time this repo's schema changes |
| `CONSULTANT_SUPERVISOR_MANUAL.md` | Plain-language day-to-day usage guide for Consultants and Supervisors (not technical) |

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
- `profiles`, `opportunities`, `opportunity_sequences`,
  `opportunity_requests` tables
- The `generate_opportunity_id()`, `void_opportunity()`,
  `request_amendment()`, `request_void()`, `review_request()`, and
  `cancel_opportunity()` functions
- All Row Level Security policies

If you already ran an earlier version of this file, running it again is
safe — see section 7 (Roles) and the upgrade notes near the end of this
document for exactly what changes and why nothing is destroyed.

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

### Promote a user to supervisor

```sql
update public.profiles
set role = 'supervisor'
where id = (select id from auth.users where email = 'supervisor@example.com');
```

### Promote a user to admin

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@example.com');
```

### Roles at a glance

| Role | Can do |
|---|---|
| Consultant | Generate Trip IDs, request amendments/voids for their own records, view/search the register, view their own request history |
| Supervisor | Everything a Consultant can, plus: review (approve/reject) a Consultant's amendment/void requests, mark a trip Cancelled |
| Admin | Everything a Supervisor can, plus: review a Supervisor's (or another Admin's) requests, void a record directly and immediately, export CSVs, promote/deactivate users |

A Supervisor or Admin can never approve their own amendment or void
request — see section 11.

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
3. Builds the ID as `M` + two-digit year + the number padded to 5 digits,
   e.g. `M2600123` (always exactly 8 characters, no hyphens).
4. Inserts the new record into the `opportunities` table.

A `UNIQUE` constraint on the ID column, another on
`(sequence_year, sequence_number)`, and a `CHECK` constraint requiring the
ID to match the 8-character `M` + 7-digit pattern are all extra safety
nets that would reject any accidental duplicate or malformed ID outright.

Because the year is read from the current date automatically, the
sequence naturally starts again at `00001` on 1 January each year — there
is no scheduled job needed.

Voided records keep their number forever, so numbers are never reused.

### Why at most 99,999 IDs per year

The 5-digit sequence has room for `00001` to `99999` — 99,999 IDs per
calendar year. Since this is a small internal app expecting at most a few
thousand opportunities a year, that ceiling is not expected to be reached
in practice. If it ever were, `generate_opportunity_id()` deliberately
raises an error on the 100,000th attempt for that year rather than ever
producing a 9-character ID that the other internal system couldn't accept.
That skipped number is never reused, the same as a voided ID.

### Timezone: the year always follows Malaysia local time

Supabase's database server runs in UTC internally. If the year were taken
directly from the server clock, an Opportunity ID generated between
00:00 and 07:59 UTC on 1 January (which is already 1 January, 08:00+ in
Malaysia) would be fine, but one generated late on 31 December UTC that
is already past midnight in Malaysia (UTC+8) would wrongly get the old
year. To avoid this, `generate_opportunity_id()` converts "now" into
`Asia/Kuala_Lumpur` time before reading the year and the two-digit `YY`
prefix:

```sql
v_year := extract(year from (now() at time zone 'Asia/Kuala_Lumpur'))::int;
v_yy := to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YY');
```

So the very first ID generated after midnight Malaysia time on 1 January
already uses the new year, e.g. `M2700001`. The `created_at` column is
unaffected — it stays a normal UTC `timestamptz`, which always represents
the correct moment in time regardless of timezone; only the year/prefix
used to build the ID is shifted to Malaysia time.

## 10. Row Level Security — what each rule means

- **profiles**: you can only see your own profile, unless you're an
  admin (admins can see everyone's).
- **opportunities — read**: any logged-in user whose `profiles.active`
  is `true` can see every record. This is a shared register, not
  private to each consultant. If an admin deactivates a user (section
  7), that user immediately loses read access to the register as well
  as the ability to generate new IDs, even though their Supabase Auth
  login still technically exists. This check is done through the
  `is_active_user()` SECURITY DEFINER helper function so the policy can
  read `profiles` without the same policy recursively checking itself.
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
- **opportunity_requests**: you can see your own requests; a Supervisor
  or Admin can see everyone's (so they can act on the approval queue).
  Like `opportunities`, there is no INSERT/UPDATE/DELETE policy for any
  role — every row is created and updated only by `request_amendment()`,
  `request_void()`, and `review_request()`, described next.

## 11. The amendment / void request workflow

The Trip ID itself is never editable by anyone, in any role. What *can*
change, with approval, is the description. This app never lets a
Consultant, Supervisor, or Admin directly overwrite the approved
description or directly flip a record to Void — every such change goes
through a request that a different, authorised person must approve.

### How a request moves through the system

1. A Consultant (or a Supervisor/Admin, for their own record) calls
   `request_amendment()` or `request_void()`. This only inserts a new row
   into `opportunity_requests` with `status = 'Pending'` — the approved
   description and the record's status are completely untouched at this
   point.
2. A Supervisor or Admin opens the **Pending Amendment / Void Requests**
   list and reviews the proposed change.
3. They call `review_request()` with a decision of `Approve` or `Reject`.
   - **Approve** an Amendment: `opportunities.current_description` and
     `full_odoo_name` are updated to the proposed text. The Trip ID
     (`opportunity_id`) is never touched.
   - **Approve** a Void: `opportunities.status` becomes `'Void'`, with
     the same `void_reason` / `voided_by` / `voided_at` fields the
     original Admin-only void has always used.
   - **Reject**: nothing about the trip changes. A rejection reason is
     mandatory and is stored permanently.
4. Either way, the request row itself is updated (never deleted) with who
   reviewed it, when, and the outcome — this is the permanent audit trail
   for every proposed change, approved or not.

### Self-approval control (enforced in the database, not just the UI)

`review_request()` refuses the call outright if `auth.uid()` (the person
calling it) is the same person who submitted the request — this applies
to every role, including an Admin reviewing their own request. On top of
that, who is *allowed* to review depends on the **requester's** role:

| Requester's role | Who may review |
|---|---|
| Consultant | Supervisor or Admin |
| Supervisor | Admin only |
| Admin | Admin only (and never themselves) |

**What this means if your Supabase project only has one Admin account:**
if that Admin submits an amendment or void request for their own record,
nobody can approve it — the single self-approval check has no other
Admin to satisfy, so the request stays `Pending` indefinitely. This is
the deliberate, fail-closed default: "an Admin must never approve their
own change" is only a real security control if there is genuinely no way
around it, including for Admins. The practical fix is simple and free on
Supabase: **create a second Admin account** (Authentication -> Users ->
Add user, then promote with the SQL in section 7) before this situation
comes up — even one held by a second trusted person who rarely logs in is
enough. There is no special "backup approver" bypass built into this app,
by design.

### Only one open request per Trip ID at a time

A unique database index (`opportunity_requests_one_pending_idx`) means a
second amendment or void request cannot be submitted for a Trip ID while
one is already `Pending`. The consultant sees "Request pending" instead
of the request buttons until the existing one is resolved.

## 12. Cancellation vs Void

These are deliberately different, both in meaning and in who can do them:

- **Cancelled** — a genuine, previously valid trip that the customer
  backed out of after confirming. The record stays exactly as it was,
  just marked Cancelled with a reason, by whom, and when
  (`cancel_reason` / `cancelled_by` / `cancelled_at`). This is a direct
  action available to a Supervisor or Admin (`cancel_opportunity()`) —
  it does not go through the approval queue, since it is recording a
  real-world outcome rather than correcting a mistake. A Consultant
  cannot call this function.
- **Void** — the Trip ID itself should never have existed (e.g. an
  accidental duplicate, or created for the wrong booking). A Consultant
  or Supervisor can only *request* a void (`request_void()`), which then
  needs Supervisor/Admin (or Admin-only, per the table above) approval
  through `review_request()`. An Admin retains the original, unchanged
  ability to void a record directly and immediately via
  `void_opportunity()`, exactly as in the first version of this app.

Neither Cancelled nor Void ever deletes a record, changes its Trip ID, or
frees up its sequence number for reuse.

## 13. Local development

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

## 14. Deploying to GitHub Pages

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

## 15. How to use the application (all roles)

1. Open the app's URL and log in with your email and password.
2. Type a description of the trip, e.g. "4 Days 3 Nights Kundasang and
   Kota Kinabalu Tour", and click **Generate ID** — normally only after a
   deposit is received (see the user manual for the full business rule).
3. The button disables itself while working, so you can't accidentally
   create two IDs by double-clicking.
4. The generated ID and the combined "ID | Description" string appear.
5. Click **Copy for Odoo**, then paste that text into Odoo's Opportunity
   Name field.
6. Use the search box under "Trip ID Register" to find a record by ID,
   description, or the name of the person who created it.

## 16. How to request an amendment or void (Consultant / Supervisor)

1. In the Trip ID Register, find a record you created (status must still
   be Active).
2. Click **Request Amendment** to propose a new description (enter both
   the proposed text and a reason), or **Request Void** if the record was
   created in error (enter a reason). Both fields are mandatory.
3. The request appears with status "Pending" both in your own **My
   Amendment / Void Requests** list and in the reviewer's approval queue.
   The current approved description is completely unchanged while it
   waits.
4. Once a Supervisor or Admin reviews it, your **My Amendment / Void
   Requests** row updates to Approved or Rejected, along with who
   reviewed it, when, and (if rejected) why.
5. If an amendment was approved, the Trip ID Register and the **Copy for
   Odoo** name now reflect the new description — copy it and update the
   existing Odoo opportunity.

## 17. How to review pending requests (Supervisor / Admin)

1. After logging in, a banner shows how many requests are awaiting your
   review (if any).
2. Open **Pending Amendment / Void Requests**. Each row shows the Trip
   ID, request type, current description, proposed description (if an
   amendment), the reason, and who requested it and when.
3. Click **Review** to open the full detail, then **Approve** or
   **Reject**. Rejecting requires a short reason, which is shown to the
   requester and stored permanently.
4. If the request is your own, no **Review** button appears — see section
   11 for why, including what to do if you are the only Admin.

## 18. How to mark a trip Cancelled (Supervisor / Admin)

1. Find the Active record in the Trip ID Register and click **Cancel**.
2. Enter a cancellation reason (required) and confirm.
3. The record now shows status "Cancelled" with the reason. It remains in
   the register permanently — this is different from Void (section 12).

## 19. How to void a record directly (Admin only)

This is the original, unchanged direct-void capability from the first
version of this app — an immediate action with no approval queue.

1. Log in as an admin.
2. Find the record in the table and click its **Admin Void** button.
3. Enter a reason (required) and click **Confirm Void**.
4. The record now shows status "Void" with the reason next to it. It
   remains in the register permanently, and its ID/number will never be
   reused.

For the request-based void that Consultants and Supervisors use instead,
see section 16.

## 20. How to export CSVs (Admin only)

1. Log in as an admin.
2. Click **Export Trip Register CSV** for the main register (Trip ID,
   current approved description, full Odoo name, created by/at, status,
   and all void/cancel audit fields).
3. Click **Export Amendment/Void History CSV** for the separate history
   of every request ever submitted — old description, proposed
   description, reason, status, requested/reviewed by and when, and any
   rejection reason.
4. Your browser downloads files named like
   `mtt-trip-register-2026-09-19.csv` and
   `mtt-amendment-void-history-2026-09-19.csv`, containing every record
   (Active, Cancelled, and Void) with all audit fields.

## 21. Troubleshooting

**"Your account is not active. Contact your administrator."**
Your `profiles.active` value is `false`, or your profile row wasn't
created. Check with `select * from public.profiles;` in the SQL Editor.

**Login succeeds but the page seems stuck / blank main screen.**
Open the browser console (F12) and look for an error. A common cause is
`config.js` still containing the placeholder URL/key — double check
section 4.

**"Failed to generate Trip ID: User account is not active"**
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

**"Annual Opportunity ID limit (99999) reached for year ..."**
That calendar year has already issued the maximum 99,999 IDs the
8-character format allows (section 9). This is not expected in normal
use for this app's scale — if you see it, double check nothing is
generating IDs in a loop, then contact your developer.

**I see old `MTT26-000123`-style IDs mixed with new `M2600001`-style
IDs in the register.**
Expected if you generated any records before running the updated
`schema.sql`. Old records keep their original ID permanently — IDs are
never edited retroactively — while every ID generated from now on uses
the new 8-character format.

**"You cannot review your own request."**
Working as intended — see section 11. Ask a different Supervisor or
Admin to review it. If you are the only Admin and the request is yours,
see section 11 for why it will stay Pending until a second Admin account
exists.

**"Only an admin may review a supervisor request" / "...an admin
request".**
Working as intended — a Supervisor's or Admin's own amendment/void
request can only be approved by an Admin, never by a Supervisor. See the
table in section 11.

**A Consultant doesn't see Request Amendment / Request Void buttons on a
record.**
Those buttons only appear on records that user created themselves, while
status is still Active, and only when there is no request already
Pending for that record (see "Only one open request per Trip ID" in
section 11).

**Request Amendment / Request Void fails with "Trip ID record not
found" or "you may only request... for a Trip ID you created".**
The RPC functions check `created_by = auth.uid()` in the database, not
just in the UI — this is expected if someone attempts the call for a
record they did not create.

## 22. Upgrade notes (schema history)

This section explains what changed each time `supabase/schema.sql` was
revised, and confirms every revision is safe to re-run over a database
that already has an earlier version. Nothing described below drops a
table, deletes a row, or requires you to recreate your Supabase project.

### A. Amendment/Approval workflow, Supervisor role, Cancelled status (this revision)

**What changed:**
- `profiles.role` now also accepts `'supervisor'`.
- `opportunities.status` now also accepts `'Cancelled'`.
- New `opportunities` columns: `current_description` (the live approved
  description — `original_description` is now a permanent, never-changed
  record of what was typed at creation), `cancel_reason`, `cancelled_by`,
  `cancelled_at`.
- New table `opportunity_requests` holds every amendment/void request
  ever submitted, approved, or rejected.
- New functions: `is_supervisor()`, `request_amendment()`,
  `request_void()`, `review_request()`, `cancel_opportunity()`.

**What did NOT change:** `generate_opportunity_id()`'s ID format and
concurrency safety, the `opportunity_id` uniqueness/format constraints,
`void_opportunity()` (Admin's direct void is exactly as before), and
every existing RLS policy that was already there.

**Is a migration step required?** No manual step. Re-running
`schema.sql` is safe:
- The role and status CHECK constraints are widened with
  `drop constraint if exists` + `add constraint`, which never touches
  row data — every existing `'consultant'`/`'admin'` role and
  `'Active'`/`'Void'` status value already satisfies the wider
  constraint.
- `current_description` is added as a nullable column, backfilled from
  `original_description` for every existing row, and only then set
  `NOT NULL` — so every existing Trip ID keeps working and displays its
  existing description immediately, with nothing to do on your part.
- The new cancellation columns and the new `opportunity_requests` table
  use `add column if not exists` / `create table if not exists`, so
  running the file again after this point is a harmless no-op.

### B. 8-character ID format (previous revision)

If you already ran an earlier version of `supabase/schema.sql` (issuing
IDs like `MTT26-000123`), here is exactly what changes and what you need
to do.

**What changed:**
- `generate_opportunity_id()` now builds IDs as `M` + 2-digit year +
  5-digit sequence (e.g. `M2600001`) instead of `MTT` + year + `-` +
  6-digit sequence.
- A new `opportunities_id_format_chk` constraint enforces that every
  *new or edited* row's `opportunity_id` matches this 8-character shape.
- A new safeguard stops generation once a year's sequence would exceed
  99,999.

**What did NOT change:** the `opportunities` and `opportunity_sequences`
tables, their columns, the uniqueness constraints, RLS policies, and the
admin-only `void_opportunity()` function are all exactly as before. No
table is dropped or recreated, and no existing row is touched.

**Is a migration step required?**

- **Re-running `schema.sql` is safe** even though you already ran an
  earlier version — every statement uses `create or replace`,
  `if not exists`, or the same guarded pattern used for the new
  constraint, so it won't fail or duplicate anything.
- **The new format constraint uses `NOT VALID`**, specifically so this
  is true even if your database already contains rows in the old
  `MTT26-000123` shape (for example, from your own testing). `NOT VALID`
  means: enforced for every row created or edited from now on, but it
  does not go back and re-check rows that are already there, so running
  this file cannot fail because of old test data.
- **You do not have to do anything else** for the app to keep working —
  from your next `Generate ID` click onward, every new record will use
  the 8-character format automatically.
- **Optional cleanup, only if you have old-format test records you don't
  need to keep:** since this app never allows deleting records, the only
  ways to deal with old-format rows are to (a) leave them exactly as they
  are — the app will display and search them fine alongside new-format
  records, they're just a different shape — or (b) void them via the
  admin **Void** button, which does not remove them but does mark them
  clearly as no longer active. Real production records should never be
  removed from the register regardless of format.
- **Optional strict validation:** once you're satisfied no row violates
  the new format (e.g. you've voided or accepted any old-format test
  rows), you can ask the constraint to fully check every existing row by
  running this once in the SQL Editor:
  ```sql
  alter table public.opportunities
    validate constraint opportunities_id_format_chk;
  ```
  Expected result: "Success. No rows returned" if every row already
  matches the 8-character format, or an error naming the first
  non-matching `opportunity_id` if not (in which case leave the
  constraint as-is — it still protects all new rows either way).

## 23. Security notes

- Never put the `service_role` key or your database password in any file
  in this repository.
- The `.gitignore` file excludes `.env` files in case you add
  environment-specific secrets later, though this app currently needs
  none beyond the public values in `config.js`.
- All real security enforcement (who can read what, who can write what,
  who can approve what) lives in Supabase's Row Level Security policies
  and the SQL functions in `supabase/schema.sql` — not in the JavaScript
  code. Even if someone bypassed the UI entirely and called the Supabase
  API directly, the same rules apply, including the self-approval and
  reviewer-authority checks inside `review_request()`.

## 24. Out of scope for this version

This app intentionally does **not** include CRM features, quotation or
costing tools, supplier/invoice management, or profitability dashboards.
It only generates controlled Trip IDs, runs the amendment/void approval
workflow, and maintains their audit register. It also does not
technically enforce the "deposit received" rule for generating a Trip
ID — that is an operating rule documented in
`CONSULTANT_SUPERVISOR_MANUAL.md`, since Odoo remains responsible for
tracking enquiry/quotation/confirmation stages. Future integration with
the Monthly Statistic Report may be added later.
