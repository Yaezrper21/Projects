# RE-VERSE

## Setup (Supabase)

1. **Create a Supabase project** at supabase.com if you haven't already.

2. **Run the schema.** Supabase → your project → SQL Editor → New query → paste
   the contents of `database/schema.sql` → Run. This creates every table,
   the enum types, the `updated_at` trigger, the `pg_trgm` extension used by
   recommendations, and seeds the genre list. There's no separate "create
   database" step — Supabase already gives you one.

3. **Get your connection details.** Project → Settings → Database →
   Connection string. Use the **Session pooler** host for most shared PHP
   hosts (it handles many short-lived connections well); use **Direct
   connection** if your host allows long-lived outbound connections.

4. **Set credentials in `config/database.php`** — `DB_HOST`, `DB_PORT`,
   `DB_USER`, `DB_PASS` (`DB_NAME` is `postgres` by default, leave as-is).
   These are the *database* password and host — not the anon/service_role
   API keys, which are for Supabase's REST layer and aren't used here.

5. **Check for `pdo_pgsql`.** Run `php -m | grep pgsql`. Most modern hosts
   have it, but unlike `pdo_mysql` it isn't universally on by default —
   if `get_db()` dies with a connection error, this is the first thing to
   check.

6. **Serve the site** from the `re-verse/` folder (Apache/Nginx/XAMPP/MAMP,
   or `php -S localhost:8000` for quick local testing).

7. **Create your admin account.** Register normally through the site, then
   in Supabase's Table Editor (or SQL Editor), run:
   ```sql
   UPDATE users SET role = 'admin' WHERE username = 'your-username';
   ```
   Log out and back in — the ADMIN TOOLS dropdown will appear in the nav.

## What changed from the MySQL version

- `database/schema.sql` is now PostgreSQL: enum types instead of MySQL
  `ENUM(...)` columns, `GENERATED ALWAYS AS IDENTITY` instead of
  `AUTO_INCREMENT`, a trigger for `updated_at` (Postgres has no
  `ON UPDATE CURRENT_TIMESTAMP`), and `pg_trgm` enabled for the
  recommendations feature's title-similarity matching.
- `config/database.php` connects via the `pgsql` PDO driver over SSL
  instead of `mysql`.
- Postgres is strict about booleans — `is_fanfiction = 0` (valid in
  MySQL) had to become `is_fanfiction = false` in the homepage queries.
- Every INSERT touching a boolean column explicitly sends `'true'`/`'false'`
  as strings rather than a raw PHP bool — PDO's `execute($array)` binds
  everything as a string, and PHP casts `false` to `""` (not `"0"`), which
  Postgres's boolean parser rejects. Worth remembering if you add more
  boolean columns later.
- Row Level Security: tables created via the SQL Editor have RLS off by
  default, and this app connects directly as the `postgres` role (which
  owns the tables and bypasses RLS regardless). That's expected here —
  the DB password stays server-side in `config/database.php` and is never
  exposed to the browser, unlike Supabase's anon/public API key pattern.

## Stage 2: series page, ratings, recommendations, admin tools

- **`series.php`** — the full novel/manga detail page: cover, title
  (300-char/2-line limit), description (2000-char limit), genre + tag
  badges, associated names, views/collections/ratings stats, an
  ADD SERIES TO +/REMOVE toggle, and the chapter table of contents
  (ASCENDING/DESCENDING + pagination, matching your wireframe's "TOS"
  panel).
- **Recommendations** (`get_recommendations()` in `includes/functions.php`)
  — weighted toward shared genres, with a smaller boost for
  title-similarity via Postgres's `pg_trgm` (falls back to genre-only if
  that extension isn't enabled on your project — it degrades quietly
  rather than breaking the page).
- **Ratings + comments** — one rating per user per series (updating your
  score/comment overwrites your previous one via `ON CONFLICT ... DO
  UPDATE`), shown newest-first below the recommendations.
- **`read.php`** — a basic chapter reader: text for novel chapters, a
  stacked page-image gallery for manga chapters, prev/next navigation,
  and it logs to `history` for Collections → History.
- **Admin tools** (`admin/`), reachable via the ADMIN TOOLS dropdown that
  appears in the nav for admin accounts:
  - `series.php` — list of all series for the current NOVEL/MANGA side,
    with Add/View/Remove.
  - `add-novel.php` — full form (title, description, cover upload, class,
    sub-format, identity, status, fan-fiction flag, genres, tags,
    associated names). Wrapped in a database transaction, so a failure
    partway through can't leave an orphaned series row.
  - `view-novel.php` — Add Chapter (a text area for novels, multi-image
    upload for manga — pages are renamed `001.jpg`, `002.jpg`... in the
    order you select them, so reading order doesn't depend on original
    filenames) and Remove Chapter. Adding a chapter also bumps the
    series' `updated_at`, so it correctly surfaces in the homepage's
    Latest Release section.
  - `delete-novel.php` — the two-step "are you sure / are you really
    sure" confirmation flow you asked for.

## Stage 3: browsing, collections, lists, dashboard, search

- **`fan-fiction.php` / `library.php`** — both are thin wrappers around
  **`includes/listing.php`**, one shared filter+results engine (Order By,
  Order, Status, multi-select Genre, pagination). On the manga side, the
  Fan-Fiction nav slot becomes "Comics" and switches to Library's fuller
  genre set + Japanese/Korean/Chinese filter, per your note — everything
  else about that page stays the Fan-Fiction layout. Genre filtering is
  AND logic (a series must match every genre you've selected, not just
  one), matching how NovelUpdates-style filters typically behave.
- **`genres.genre_type`** (new column, `'library'` or `'fandom'`) — lets
  the two sidebars pull the right genre set. `database/migrations.sql`
  is provided if you already ran the original schema.sql on Supabase;
  a fresh run of `schema.sql` already includes it.
- **`collections.php`** — Collection and History shown as two columns
  side by side (both visible at once, not a tab switch — that's what
  your wireframe's paired layout looked like), plus a small FILTER
  dropdown for status.
- **`lists.php` + `list.php`** — Lists/Browse as switchable tabs, a
  collapsible "+ Create New List" form, and a detail page for each list.
  I also added a compact "add to list" control on `series.php` itself —
  without it, lists could be created but never actually populated, which
  didn't feel like "working properly."
- **`user.php`** — a simple profile/dashboard (account info + counts +
  shortcuts). Not detailed in your wireframe, so I kept it minimal
  rather than guessing at a design you didn't ask for.
- **`search.php`** — matches on title and associated names, ranked by
  `pg_trgm` similarity when available (falls back to newest-first if
  that extension isn't enabled).
- Shared a `render_series_card()` helper across listing/collections/
  search so every result card — homepage, library, collections, search —
  looks and behaves identically. New pages reuse it; the homepage's
  original inline version was left alone since it already works.

## Known limitations (intentional, for now)

- Deleting a novel or a chapter removes the database rows but doesn't
  clean up the uploaded files in `assets/uploads/` — they're orphaned,
  not deleted. Fine to ignore for now; worth revisiting before this goes
  to real users with real storage costs.
- The view counter increments once per page load of `series.php` — simple
  and matches the "views" field you asked for, but it's not
  de-duplicated per visitor.
- No image storage integration with Supabase Storage yet — uploads go to
  the PHP server's local disk (`assets/uploads/`). That's the simplest
  path and works on any normal host, but won't persist on something like
  a serverless/ephemeral host. Say the word if you want that swapped.
- List creation doesn't re-fill the form on a validation error (e.g.
  empty title) — you'd just retype it. Small, low-stakes gap.

## Everything built so far

Homepage, login/register, settings (theme), series detail page with
ratings/comments/recommendations, chapter reader, full admin tooling
(add/view/remove novel, add/remove chapters), Fan-Fiction, Comics,
Library, Collections (+ History), Lists (+ Browse, + detail view),
user dashboard, and search.

Nothing left from the original spec — happy to dig into any part of it
with you once you've had a chance to test it.
