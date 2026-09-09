-- =====================================================================
-- RE-VERSE Database Schema
-- A combined novel + manga/manhwa/manhua reading platform
-- =====================================================================

CREATE DATABASE IF NOT EXISTS re_verse CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE re_verse;

-- ---------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(30)  NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            ENUM('user','admin') NOT NULL DEFAULT 'user',
    avatar_image    VARCHAR(255) DEFAULT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- SERIES  (a "series" row is either a NOVEL or a MANGA/MANHWA/MANHUA;
-- fan-fiction and comics are just series flagged accordingly)
-- ---------------------------------------------------------------------
CREATE TABLE series (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(300) NOT NULL,
    description     VARCHAR(2000) NOT NULL,
    cover_image     VARCHAR(255) DEFAULT NULL,

    -- NOVEL or MANGA (manga bucket covers manga/manhwa/manhua, see sub_format)
    class           ENUM('novel','manga') NOT NULL,
    sub_format      ENUM('manga','manhwa','manhua') DEFAULT NULL,   -- only used when class = manga
    identity        ENUM('japanese','korean','chinese') DEFAULT NULL,

    status          ENUM('ongoing','completed','hiatus') NOT NULL DEFAULT 'ongoing',
    is_fanfiction   TINYINT(1) NOT NULL DEFAULT 0,   -- novel side: fan-fiction nav
                                                       -- manga side: reuse this flag for "comics" nav if desired

    views           INT UNSIGNED NOT NULL DEFAULT 0,
    uploaded_by      INT UNSIGNED DEFAULT NULL,        -- admin who added it

    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_class (class),
    INDEX idx_updated (updated_at),
    INDEX idx_views (views)
) ENGINE=InnoDB;

-- Alternate/associated names for a series (e.g. original JP/KR/CN title)
CREATE TABLE series_associated_names (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    series_id   INT UNSIGNED NOT NULL,
    name        VARCHAR(300) NOT NULL,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- GENRES & TAGS (many-to-many with series)
-- ---------------------------------------------------------------------
CREATE TABLE genres (
    id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name    VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE series_genres (
    series_id   INT UNSIGNED NOT NULL,
    genre_id    INT UNSIGNED NOT NULL,
    PRIMARY KEY (series_id, genre_id),
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
    FOREIGN KEY (genre_id)  REFERENCES genres(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE tags (
    id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name    VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE series_tags (
    series_id   INT UNSIGNED NOT NULL,
    tag_id      INT UNSIGNED NOT NULL,
    PRIMARY KEY (series_id, tag_id),
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id)    REFERENCES tags(id)    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- CHAPTERS
-- ---------------------------------------------------------------------
CREATE TABLE chapters (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    series_id       INT UNSIGNED NOT NULL,
    chapter_number  DECIMAL(8,2) NOT NULL,   -- allows 10.5 style chapters
    title           VARCHAR(255) DEFAULT NULL,
    content         MEDIUMTEXT DEFAULT NULL,     -- novel text content
    image_folder    VARCHAR(255) DEFAULT NULL,   -- manga page images live here
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_series_chapter (series_id, chapter_number),
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- COLLECTIONS (= favorites) and READING HISTORY
-- ---------------------------------------------------------------------
CREATE TABLE collections (
    user_id     INT UNSIGNED NOT NULL,
    series_id   INT UNSIGNED NOT NULL,
    added_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, series_id),
    FOREIGN KEY (user_id)   REFERENCES users(id)  ON DELETE CASCADE,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE history (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    series_id   INT UNSIGNED NOT NULL,
    chapter_id  INT UNSIGNED DEFAULT NULL,
    viewed_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
    FOREIGN KEY (series_id) REFERENCES series(id)  ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
    INDEX idx_user_time (user_id, viewed_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- LISTS (user-curated lists) and BROWSE (public lists)
-- ---------------------------------------------------------------------
CREATE TABLE lists (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    title       VARCHAR(150) NOT NULL,
    description VARCHAR(500) DEFAULT NULL,
    is_public   TINYINT(1) NOT NULL DEFAULT 1,
    views       INT UNSIGNED NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE list_items (
    list_id     INT UNSIGNED NOT NULL,
    series_id   INT UNSIGNED NOT NULL,
    added_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (list_id, series_id),
    FOREIGN KEY (list_id)   REFERENCES lists(id)  ON DELETE CASCADE,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- RATINGS + COMMENTS  (one rating row per user per series, with optional comment)
-- ---------------------------------------------------------------------
CREATE TABLE ratings (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    series_id   INT UNSIGNED NOT NULL,
    score       TINYINT UNSIGNED NOT NULL,   -- 1 to 10
    comment     VARCHAR(1000) DEFAULT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_series_rating (user_id, series_id),
    FOREIGN KEY (user_id)   REFERENCES users(id)  ON DELETE CASCADE,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
    CHECK (score BETWEEN 1 AND 10)
) ENGINE=InnoDB;

-- =====================================================================
-- Seed data: base genre list (novel side uses the larger genre set,
-- fan-fiction uses the smaller "fandom" set from the wireframe)
-- =====================================================================
INSERT INTO genres (name) VALUES
('Action'),('Adult'),('Adventure'),('Comedy'),('Drama'),('Ecchi'),('Fantasy'),
('Game'),('Gender Bender'),('Harem'),('Historical'),('Horror'),('Martial Arts'),
('Mature'),('Mecha'),('Mystery'),('Psychological'),('Romance'),('School Life'),
('Sci-fi'),('Seinen'),('Shoujo'),('Shounen'),('Slice of Life'),('Sports'),
('Supernatural'),('Tragedy'),('Yaoi'),('Yuri'),
('Animanga'),('Books & Literature'),('Cartoons & Comics'),('Celebrities & Real People'),
('Movies'),('Music & Bands'),('Other Media'),('Theater'),('TV Shows'),('Video Games'),
('Uncategorized');
