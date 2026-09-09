-- =====================================================================
-- RE-VERSE Database Schema — PostgreSQL / Supabase edition
--
-- Run this in Supabase: Project → SQL Editor → New query → paste → Run.
-- Supabase already gives you a database (no CREATE DATABASE step needed);
-- this just creates tables in the `public` schema.
-- =====================================================================

-- Lets the recommendations feature match on similar titles, not just
-- shared genres (see get_recommendations() in includes/functions.php).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------
CREATE TYPE user_role        AS ENUM ('user', 'admin');
CREATE TYPE series_class     AS ENUM ('novel', 'manga');
CREATE TYPE series_subformat AS ENUM ('manga', 'manhwa', 'manhua');
CREATE TYPE series_identity  AS ENUM ('japanese', 'korean', 'chinese');
CREATE TYPE series_status    AS ENUM ('ongoing', 'completed', 'hiatus');

-- Postgres has no "ON UPDATE CURRENT_TIMESTAMP" like MySQL — this trigger
-- function is the standard replacement, reused on every updated_at column.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username        varchar(30)  NOT NULL UNIQUE,
    email           varchar(255) NOT NULL UNIQUE,
    password_hash   varchar(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'user',
    avatar_image    varchar(255),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- SERIES  (a row is either a NOVEL or a MANGA/MANHWA/MANHUA; fan-fiction
-- and comics are just series flagged with is_fanfiction)
-- ---------------------------------------------------------------------
CREATE TABLE series (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title           varchar(300) NOT NULL,
    description     varchar(2000) NOT NULL,
    cover_image     varchar(255),

    class           series_class NOT NULL,
    sub_format      series_subformat,      -- only used when class = 'manga'
    identity        series_identity,

    status          series_status NOT NULL DEFAULT 'ongoing',
    is_fanfiction   boolean NOT NULL DEFAULT false,

    views           integer NOT NULL DEFAULT 0,
    uploaded_by     integer REFERENCES users(id) ON DELETE SET NULL,

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_series_updated_at
    BEFORE UPDATE ON series
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_series_class   ON series(class);
CREATE INDEX idx_series_updated ON series(updated_at);
CREATE INDEX idx_series_views   ON series(views);
CREATE INDEX idx_series_title_trgm ON series USING gin (title gin_trgm_ops);

CREATE TABLE series_associated_names (
    id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    series_id   integer NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    name        varchar(300) NOT NULL
);

-- ---------------------------------------------------------------------
-- GENRES & TAGS (many-to-many with series)
-- ---------------------------------------------------------------------
CREATE TABLE genres (
    id      integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name    varchar(50) NOT NULL UNIQUE,
    genre_type varchar(10) NOT NULL DEFAULT 'library' CHECK (genre_type IN ('library', 'fandom'))
);

CREATE TABLE series_genres (
    series_id   integer NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    genre_id    integer NOT NULL REFERENCES genres(id)  ON DELETE CASCADE,
    PRIMARY KEY (series_id, genre_id)
);

CREATE TABLE tags (
    id      integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name    varchar(50) NOT NULL UNIQUE
);

CREATE TABLE series_tags (
    series_id   integer NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    tag_id      integer NOT NULL REFERENCES tags(id)    ON DELETE CASCADE,
    PRIMARY KEY (series_id, tag_id)
);

-- ---------------------------------------------------------------------
-- CHAPTERS
-- ---------------------------------------------------------------------
CREATE TABLE chapters (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    series_id       integer NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    chapter_number  numeric(8,2) NOT NULL,   -- allows 10.5-style chapters
    title           varchar(255),
    content         text,                     -- novel text content
    image_folder    varchar(255),             -- manga page images live here
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uniq_series_chapter UNIQUE (series_id, chapter_number)
);

-- ---------------------------------------------------------------------
-- COLLECTIONS (= favorites) and READING HISTORY
-- ---------------------------------------------------------------------
CREATE TABLE collections (
    user_id     integer NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    series_id   integer NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    added_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, series_id)
);

CREATE TABLE history (
    id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     integer NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    series_id   integer NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    chapter_id  integer REFERENCES chapters(id) ON DELETE SET NULL,
    viewed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_history_user_time ON history(user_id, viewed_at);

-- ---------------------------------------------------------------------
-- LISTS (user-curated) — lists tab shows own, browse tab shows public ones
-- ---------------------------------------------------------------------
CREATE TABLE lists (
    id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       varchar(150) NOT NULL,
    description varchar(500),
    is_public   boolean NOT NULL DEFAULT true,
    views       integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE list_items (
    list_id     integer NOT NULL REFERENCES lists(id)  ON DELETE CASCADE,
    series_id   integer NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    added_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (list_id, series_id)
);

-- ---------------------------------------------------------------------
-- RATINGS + COMMENTS (one rating row per user per series)
-- ---------------------------------------------------------------------
CREATE TABLE ratings (
    id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     integer NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    series_id   integer NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    score       smallint NOT NULL CHECK (score BETWEEN 1 AND 10),
    comment     varchar(1000),
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uniq_user_series_rating UNIQUE (user_id, series_id)
);

-- =====================================================================
-- Seed data: Library uses the full genre set, Fan-Fiction/Comics use
-- the smaller "fandom" set from the wireframe.
-- =====================================================================
INSERT INTO genres (name, genre_type) VALUES
('Action','library'),('Adult','library'),('Adventure','library'),('Comedy','library'),
('Drama','library'),('Ecchi','library'),('Fantasy','library'),('Game','library'),
('Gender Bender','library'),('Harem','library'),('Historical','library'),('Horror','library'),
('Martial Arts','library'),('Mature','library'),('Mecha','library'),('Mystery','library'),
('Psychological','library'),('Romance','library'),('School Life','library'),('Sci-fi','library'),
('Seinen','library'),('Shoujo','library'),('Shounen','library'),('Slice of Life','library'),
('Sports','library'),('Supernatural','library'),('Tragedy','library'),('Yaoi','library'),('Yuri','library'),
('Animanga','fandom'),('Books & Literature','fandom'),('Cartoons & Comics','fandom'),
('Celebrities & Real People','fandom'),('Movies','fandom'),('Music & Bands','fandom'),
('Other Media','fandom'),('Theater','fandom'),('TV Shows','fandom'),('Video Games','fandom'),
('Uncategorized','fandom');

-- Note on Row Level Security: Supabase tables you create via SQL editor
-- have RLS off by default, and the app connects directly as the
-- `postgres` role (via PDO), which owns these tables and bypasses RLS
-- regardless. That's expected for this architecture — the DB password
-- never leaves the server, unlike the anon/public API key Supabase's
-- REST layer normally relies on. If you ever add a client-side Supabase
-- SDK on top of this later, RLS policies would need to be written then.
