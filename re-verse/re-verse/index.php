<?php
require_once __DIR__ . '/config/config.php';

$type = ($_GET['type'] ?? 'novel') === 'manga' ? 'manga' : 'novel';
$db = get_db();

/* ---------------------------------------------------------------
 * POPULAR: 5 per page, 3 pages max (15 total), ranked by views.
 * ------------------------------------------------------------- */
$popularPage = max(1, min(3, (int)($_GET['popular_page'] ?? 1)));
$popularOffset = ($popularPage - 1) * 5;

$stmt = $db->prepare(
    'SELECT id, title, cover_image
     FROM series
     WHERE class = :type AND is_fanfiction = false
     ORDER BY views DESC, id ASC
     LIMIT 5 OFFSET :offset'
);
$stmt->bindValue(':type', $type, PDO::PARAM_STR);
$stmt->bindValue(':offset', $popularOffset, PDO::PARAM_INT);
$stmt->execute();
$popular = $stmt->fetchAll();

/* ---------------------------------------------------------------
 * LATEST RELEASE: 10 per page, 10 pages max (100 total), by updated_at.
 * ------------------------------------------------------------- */
$latestPage = max(1, min(10, (int)($_GET['page'] ?? 1)));
$latestOffset = ($latestPage - 1) * 10;

$stmt = $db->prepare(
    'SELECT s.id, s.title, s.description, s.cover_image, s.status, s.updated_at, s.identity,
            (SELECT COUNT(*) FROM chapters c WHERE c.series_id = s.id) AS chapter_count,
            (SELECT COUNT(*) FROM collections co WHERE co.series_id = s.id) AS collection_count,
            (SELECT ROUND(AVG(score),1) FROM ratings r WHERE r.series_id = s.id) AS avg_rating
     FROM series s
     WHERE s.class = :type AND s.is_fanfiction = false
     ORDER BY s.updated_at DESC, s.id DESC
     LIMIT 10 OFFSET :offset'
);
$stmt->bindValue(':type', $type, PDO::PARAM_STR);
$stmt->bindValue(':offset', $latestOffset, PDO::PARAM_INT);
$stmt->execute();
$latest = $stmt->fetchAll();

/* Genres per series shown in the latest-release rows */
$genreStmt = $db->prepare(
    'SELECT g.name FROM genres g
     JOIN series_genres sg ON sg.genre_id = g.id
     WHERE sg.series_id = ?'
);

$pageTitle = ucfirst($type) . ' — Home';
require __DIR__ . '/includes/header.php';
?>

<section class="section">
    <h2 class="section-title">POPULAR</h2>
    <div class="popular-track">
        <?php if ($popularPage > 1): ?>
            <a class="arrow-btn" href="?type=<?= h($type) ?>&popular_page=<?= $popularPage - 1 ?>#popular">&#9664;</a>
        <?php else: ?>
            <button class="arrow-btn" disabled>&#9664;</button>
        <?php endif; ?>

        <div class="popular-grid">
            <?php if (empty($popular)): ?>
                <p style="grid-column: 1 / -1; color: var(--text-muted);">No <?= h($type) ?> series yet — check back soon.</p>
            <?php endif; ?>
            <?php foreach ($popular as $s): ?>
                <a class="popular-card" href="series.php?id=<?= (int)$s['id'] ?>">
                    <div class="popular-cover">
                        <?php if ($s['cover_image']): ?>
                            <img src="<?= h($s['cover_image']) ?>" alt="<?= h($s['title']) ?>">
                        <?php endif; ?>
                    </div>
                    <div class="popular-title"><?= h(popular_title($s['title'])) ?></div>
                </a>
            <?php endforeach; ?>
        </div>

        <?php if ($popularPage < 3): ?>
            <a class="arrow-btn" href="?type=<?= h($type) ?>&popular_page=<?= $popularPage + 1 ?>#popular">&#9654;</a>
        <?php else: ?>
            <button class="arrow-btn" disabled>&#9654;</button>
        <?php endif; ?>
    </div>

    <div class="popular-pager">
        <?php for ($p = 1; $p <= 3; $p++): ?>
            <a href="?type=<?= h($type) ?>&popular_page=<?= $p ?>#popular" class="<?= $p === $popularPage ? 'current' : '' ?>"><?= $p ?></a>
        <?php endfor; ?>
    </div>
</section>

<section class="section" id="latest">
    <h2 class="section-title">LATEST RELEASE</h2>

    <?php if (empty($latest)): ?>
        <p style="color: var(--text-muted);">Nothing here yet.</p>
    <?php endif; ?>

    <?php foreach ($latest as $s): ?>
        <?php
        $genreStmt->execute([$s['id']]);
        $genres = array_column($genreStmt->fetchAll(), 'name');
        ?>
        <div class="release-row">
            <a class="release-cover" href="series.php?id=<?= (int)$s['id'] ?>">
                <?php if ($s['cover_image']): ?>
                    <img src="<?= h($s['cover_image']) ?>" alt="<?= h($s['title']) ?>">
                <?php endif; ?>
            </a>
            <div class="release-info">
                <a href="series.php?id=<?= (int)$s['id'] ?>">
                    <h3 class="release-title"><?= h(latest_release_title($s['title'])) ?></h3>
                </a>
                <div class="release-meta"><?= h(series_meta_line($s)) ?></div>
                <div class="genres">
                    <?php foreach ($genres as $g): ?>
                        <span class="genre-badge"><?= h($g) ?></span>
                    <?php endforeach; ?>
                </div>
                <p class="release-desc"><?= h(latest_release_description($s['description'])) ?></p>
                <div class="rating-line">RATINGS (<?= $s['avg_rating'] !== null ? h((string)$s['avg_rating']) : '—' ?>/10)</div>
            </div>
        </div>
    <?php endforeach; ?>

    <div class="pagination">
        <a href="?type=<?= h($type) ?>&page=1#latest" <?= $latestPage === 1 ? 'style="visibility:hidden"' : '' ?>>&#9666;</a>
        <a href="?type=<?= h($type) ?>&page=<?= max(1, $latestPage - 1) ?>#latest" <?= $latestPage === 1 ? 'style="visibility:hidden"' : '' ?>>&#9664;</a>
        <?php for ($p = 1; $p <= 10; $p++): ?>
            <a href="?type=<?= h($type) ?>&page=<?= $p ?>#latest" class="<?= $p === $latestPage ? 'current' : '' ?>"><?= $p ?></a>
        <?php endfor; ?>
        <a href="?type=<?= h($type) ?>&page=<?= min(10, $latestPage + 1) ?>#latest" <?= $latestPage === 10 ? 'style="visibility:hidden"' : '' ?>>&#9654;</a>
        <a href="?type=<?= h($type) ?>&page=10#latest" <?= $latestPage === 10 ? 'style="visibility:hidden"' : '' ?>>&#9667;</a>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
