# RE-VERSE — Stage 1

This is the foundation of the site: database schema, the homepage
(NOVEL/MANGA toggle, Popular, Latest Release), and Login/Register.
Everything else (fan-fiction, library, collections, lists, series detail,
admin tools) comes in later stages — this stage needs to work first since
it's what everything else builds on.

## Setup

1. **Create the database.** In phpMyAdmin, MySQL Workbench, or the CLI, run:
   ```
   mysql -u root -p < database/schema.sql
   ```
   This creates the `re_verse` database, all tables, and seeds the genre list.

2. **Set your DB credentials.** Edit `config/database.php` and fill in
   `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` for your MySQL setup.

3. **Serve the site.** Point your web server (Apache/Nginx/XAMPP/MAMP) at
   the `re-verse/` folder, or for quick local testing:
   ```
   php -S localhost:8000
   ```
   then visit `http://localhost:8000/`.

4. **Add some test data** so the homepage isn't empty — insert a couple of
   rows into `series` (with `class` = 'novel' or 'manga') directly, since
   the admin "Add Novel" tool comes in a later stage.

## What's here

- `database/schema.sql` — full schema: users, series, genres, tags,
  chapters, collections (favorites), history, lists, ratings+comments.
  Built ahead of schedule so later stages don't require migrations.
- `config/database.php` — PDO/MySQL connection.
- `config/config.php` — session bootstrap, loaded at the top of every page.
- `includes/functions.php` — the title/description truncation rules
  (30-char popular titles, 80-char/2-line latest-release titles, 200-char
  descriptions, 300-char/2-line series titles, 2000-char series
  descriptions — all anchored with "...").
- `includes/auth.php` — register/login/logout, password hashing, CSRF
  tokens, `require_login()` / `require_admin()` guards.
- `includes/header.php` / `footer.php` — shared nav, the black/white
  NOVEL↔MANGA switch, and the search/settings login gate.
- `index.php` — homepage: Popular (5 per page × 3 pages = 15) and Latest
  Release (10 per page × 10 pages = 100), both live from the database.
- `login.php` — combined login/register with the tabbed layout from your
  wireframe.
- `settings.php` — light/dark mode toggle (light is default), stored in
  the session.

## Notes on decisions made

- **Genres table is seeded** with both the Library genre set and the
  smaller Fan-Fiction/fandom set from your wireframes, so both work once
  those pages are built.
- **`class` = novel/manga** on the `series` table; manga's `sub_format`
  column (manga/manhwa/manhua) and `identity` (Japanese/Korean/Chinese)
  are separate columns so filtering by either is a simple query.
- **Ratings include comments** in the same table (one rating+comment per
  user per series), ready for the recommendations/ratings section later.
- Admin role is a column on `users` (`role` = 'user'/'admin') rather than
  a separate table — simplest thing that works for `require_admin()`.

## Next stages (in order)

1. Series detail page + admin "Add/Remove/View Novel" tools (these need
   to exist together, since the detail page is what admin tooling feeds).
2. Fan-fiction / Library / Comics pages (the sort-sidebar + results layout).
3. Collections, Lists (create + browse), User dashboard.
4. Ratings/comments UI + genre-based recommendations on the series page.

Let me know when you're ready for stage 2, or if you'd rather reorder this list.
