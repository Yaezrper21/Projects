-- =====================================================================
-- RE-VERSE — Migration: adds genre_type to an already-created database.
-- Only run this if you ran schema.sql BEFORE this stage (i.e. `genres`
-- already exists without a genre_type column). A fresh schema.sql run
-- already includes this — skip this file in that case.
-- =====================================================================

ALTER TABLE genres ADD COLUMN IF NOT EXISTS genre_type varchar(10) NOT NULL DEFAULT 'library';
ALTER TABLE genres ADD CONSTRAINT genres_genre_type_check CHECK (genre_type IN ('library', 'fandom'));

UPDATE genres SET genre_type = 'fandom' WHERE name IN (
    'Animanga','Books & Literature','Cartoons & Comics','Celebrities & Real People',
    'Movies','Music & Bands','Other Media','Theater','TV Shows','Video Games','Uncategorized'
);
