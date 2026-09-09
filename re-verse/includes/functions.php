<?php
/**
 * RE-VERSE — Shared helper functions
 */

/**
 * Truncate a title to a hard character limit, always appending "..."
 * (anchored directly to the last visible character) when cut short.
 */
function truncate_title(string $title, int $limit): string
{
    $title = trim($title);
    if (mb_strlen($title) <= $limit) {
        return $title;
    }
    return rtrim(mb_substr($title, 0, $limit)) . '...';
}

/**
 * Truncate a description. $min is the point after which we're allowed to
 * cut — anything under $min characters is shown in full, untouched.
 */
function truncate_description(string $desc, int $min): string
{
    $desc = trim($desc);
    if (mb_strlen($desc) <= $min) {
        return $desc;
    }
    return rtrim(mb_substr($desc, 0, $min)) . '...';
}

/** Popular section: 30-char title limit. */
function popular_title(string $title): string
{
    return truncate_title($title, 30);
}

/** Latest release section: 80-char title limit. */
function latest_release_title(string $title): string
{
    return truncate_title($title, 80);
}

/** Latest release section: description shown in full up to 200 chars, then "...". */
function latest_release_description(string $desc): string
{
    return truncate_description($desc, 200);
}

/** Novel detail page: 300-char title limit. */
function novel_page_title(string $title): string
{
    return truncate_title($title, 300);
}

/** Novel detail page: description shown in full up to 2000 chars, then "...". */
function novel_page_description(string $desc): string
{
    return truncate_description($desc, 2000);
}

/** Formats a NUMERIC(8,2) chapter number for display: "12.00" -> "12", "12.50" -> "12.5" */
function format_chapter_number(string|float $number): string
{
    return rtrim(rtrim((string)$number, '0'), '.');
}

/** MM/DD/YY date format used across the wireframe, e.g. 12/21/26 */
function format_updated_date(string $timestamp): string
{
    $ts = strtotime($timestamp);
    return date('m/d/y', $ts);
}

/** Builds the "100 CHAPTERS, 10 COLLECTIONS  ONGOING  12/21/26  Japanese" meta line. */
function series_meta_line(array $series): string
{
    $chapters    = (int)($series['chapter_count'] ?? 0);
    $collections = (int)($series['collection_count'] ?? 0);
    $status      = strtoupper($series['status'] ?? '');
    $updated     = format_updated_date($series['updated_at']);
    $identity    = $series['identity'] ? ucfirst($series['identity']) : '';

    $parts = [
        $chapters . ' CHAPTERS, ' . $collections . ' COLLECTIONS',
        $status,
        $updated,
        $identity,
    ];

    return implode('  ', array_filter($parts));
}

function h(?string $value): string
{
    return htmlspecialchars($value ?? '', ENT_QUOTES, 'UTF-8');
}

function redirect(string $path): never
{
    header('Location: ' . $path);
    exit;
}

/* ---------------------------------------------------------------
 * Flash messages (one-time notices shown after a redirect)
 * ------------------------------------------------------------- */
function flash_set(string $message, string $type = 'success'): void
{
    $_SESSION['flash'] = ['message' => $message, 'type' => $type];
}

function flash_get(): ?array
{
    if (empty($_SESSION['flash'])) {
        return null;
    }
    $flash = $_SESSION['flash'];
    unset($_SESSION['flash']);
    return $flash;
}

/* ---------------------------------------------------------------
 * Image upload — used for series covers and manga chapter pages.
 * Returns the stored path (relative to site root) on success, or
 * an error string on failure.
 * ------------------------------------------------------------- */
function handle_image_upload(array $file, string $subdir): string|null
{
    if (!isset($file['error']) || $file['error'] === UPLOAD_ERR_NO_FILE) {
        return null; // nothing uploaded — not necessarily an error
    }
    if ($file['error'] !== UPLOAD_ERR_OK) {
        return null;
    }

    $allowed = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!isset($allowed[$ext])) {
        return null;
    }

    $mime = mime_content_type($file['tmp_name']);
    if ($mime !== $allowed[$ext]) {
        return null;
    }

    $destDir = __DIR__ . '/../assets/uploads/' . trim($subdir, '/');
    if (!is_dir($destDir)) {
        mkdir($destDir, 0755, true);
    }

    $filename = bin2hex(random_bytes(8)) . '.' . $ext;
    $destPath = $destDir . '/' . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        return null;
    }

    return 'assets/uploads/' . trim($subdir, '/') . '/' . $filename;
}

/**
 * Uploads multiple chapter-page images (manga side) into one folder,
 * renaming them 001.ext, 002.ext... in submission order so reading
 * order doesn't depend on the original filenames. Returns the count
 * of pages successfully stored.
 */
function handle_chapter_pages_upload(array $filesInput, string $subdir): int
{
    if (empty($filesInput['name']) || !is_array($filesInput['name'])) {
        return 0;
    }

    $allowed = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
    $destDir = __DIR__ . '/../assets/uploads/' . trim($subdir, '/');
    if (!is_dir($destDir)) {
        mkdir($destDir, 0755, true);
    }

    $stored = 0;
    $count = count($filesInput['name']);
    for ($i = 0; $i < $count; $i++) {
        if (($filesInput['error'][$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            continue;
        }
        $ext = strtolower(pathinfo($filesInput['name'][$i], PATHINFO_EXTENSION));
        if (!isset($allowed[$ext])) {
            continue;
        }
        if (mime_content_type($filesInput['tmp_name'][$i]) !== $allowed[$ext]) {
            continue;
        }
        $stored++;
        $destName = str_pad((string)$stored, 3, '0', STR_PAD_LEFT) . '.' . $ext;
        move_uploaded_file($filesInput['tmp_name'][$i], $destDir . '/' . $destName);
    }

    return $stored;
}

/* ---------------------------------------------------------------
 * Recommendations: genre overlap (weighted higher) + title
 * similarity via pg_trgm (weighted lower, skipped quietly if the
 * extension isn't available on this Supabase project).
 * ------------------------------------------------------------- */
function get_recommendations(PDO $db, int $seriesId, string $class, string $title, int $limit = 6): array
{
    $scores = [];
    $meta = [];

    $stmt = $db->prepare(
        'SELECT s2.id, s2.title, s2.cover_image, COUNT(*) AS shared
         FROM series_genres sg1
         JOIN series_genres sg2 ON sg2.genre_id = sg1.genre_id AND sg2.series_id <> sg1.series_id
         JOIN series s2 ON s2.id = sg2.series_id AND s2.class = :class
         WHERE sg1.series_id = :id
         GROUP BY s2.id, s2.title, s2.cover_image'
    );
    $stmt->execute(['id' => $seriesId, 'class' => $class]);
    foreach ($stmt->fetchAll() as $row) {
        $scores[$row['id']] = ($scores[$row['id']] ?? 0) + ((int)$row['shared'] * 2);
        $meta[$row['id']] = $row;
    }

    try {
        // Positional placeholders here on purpose: PDO_PGSQL with real
        // (non-emulated) prepares can mis-handle a named parameter that
        // repeats within one query, so :title isn't reused.
        $stmt = $db->prepare(
            'SELECT id, title, cover_image, similarity(title, ?) AS sim
             FROM series
             WHERE id <> ? AND class = ? AND similarity(title, ?) > 0.3
             ORDER BY sim DESC
             LIMIT 10'
        );
        $stmt->execute([$title, $seriesId, $class, $title]);
        foreach ($stmt->fetchAll() as $row) {
            $scores[$row['id']] = ($scores[$row['id']] ?? 0) + ((float)$row['sim'] * 5);
            $meta[$row['id']] = $row;
        }
    } catch (PDOException $e) {
        // pg_trgm not enabled on this project — genre-based results still stand.
    }

    arsort($scores);
    $topIds = array_slice(array_keys($scores), 0, $limit);
    return array_map(fn($id) => $meta[$id], $topIds);
}

/**
 * Renders one release-row card (cover, title, meta line, genres,
 * description, rating). Shared by the homepage's pattern, listing
 * pages, collections, and search so the result card stays consistent
 * everywhere it appears.
 */
function render_series_card(array $s, PDOStatement $genreStmt): void
{
    $genreStmt->execute([$s['id']]);
    $genres = array_column($genreStmt->fetchAll(), 'name');
    ?>
    <div class="release-row">
        <a class="release-cover" href="<?= BASE_URL ?>series.php?id=<?= (int)$s['id'] ?>">
            <?php if (!empty($s['cover_image'])): ?>
                <img src="<?= h(BASE_URL . $s['cover_image']) ?>" alt="<?= h($s['title']) ?>">
            <?php endif; ?>
        </a>
        <div class="release-info">
            <a href="<?= BASE_URL ?>series.php?id=<?= (int)$s['id'] ?>">
                <h3 class="release-title"><?= h(latest_release_title($s['title'])) ?></h3>
            </a>
            <div class="release-meta"><?= h(series_meta_line($s)) ?></div>
            <div class="genres">
                <?php foreach ($genres as $g): ?><span class="genre-badge"><?= h($g) ?></span><?php endforeach; ?>
            </div>
            <p class="release-desc"><?= h(latest_release_description($s['description'])) ?></p>
            <div class="rating-line">RATINGS (<?= $s['avg_rating'] !== null ? h((string)$s['avg_rating']) : '—' ?>/10)</div>
        </div>
    </div>
    <?php
}

/**
 * Builds a link that preserves every current query param except the
 * given overrides, and resets pagination to page 1 whenever a filter
 * changes (unless the override IS the page itself). A null override
 * value removes that param entirely (e.g. clearing a filter).
 */
function listing_link(string $baseAction, array $overrides): string
{
    $params = $_GET;
    if (!array_key_exists('page', $overrides)) {
        unset($params['page']);
    }
    foreach ($overrides as $k => $v) {
        if ($v === null) {
            unset($params[$k]);
        } else {
            $params[$k] = $v;
        }
    }
    return $baseAction . '?' . http_build_query($params);
}

/** Toggles one genre id in/out of the current multi-select genre filter. */
function genre_toggle_link(string $baseAction, array $currentGenres, int $genreId): string
{
    $genres = in_array($genreId, $currentGenres, true)
        ? array_values(array_diff($currentGenres, [$genreId]))
        : array_merge($currentGenres, [$genreId]);
    return listing_link($baseAction, ['genre' => $genres ?: null]);
}
