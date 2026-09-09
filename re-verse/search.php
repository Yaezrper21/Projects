<?php
require_once __DIR__ . '/config/config.php';
require_login();

$db = get_db();
$q = trim($_GET['q'] ?? '');
$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = 10;
$results = [];
$totalPages = 1;

if ($q !== '') {
    $likeTerm = '%' . $q . '%';

    $countStmt = $db->prepare(
        'SELECT COUNT(DISTINCT s.id) FROM series s
         LEFT JOIN series_associated_names an ON an.series_id = s.id
         WHERE s.title ILIKE ? OR an.name ILIKE ?'
    );
    $countStmt->execute([$likeTerm, $likeTerm]);
    $totalResults = (int)$countStmt->fetchColumn();
    $totalPages = max(1, (int)ceil($totalResults / $perPage));
    $page = min($page, $totalPages);

    $cardFields = "s.id, s.title, s.description, s.cover_image, s.status, s.updated_at, s.identity,
        (SELECT COUNT(*) FROM chapters c WHERE c.series_id = s.id) AS chapter_count,
        (SELECT COUNT(*) FROM collections co WHERE co.series_id = s.id) AS collection_count,
        (SELECT ROUND(AVG(score),1) FROM ratings r WHERE r.series_id = s.id) AS avg_rating";

    try {
        $stmt = $db->prepare(
            "SELECT DISTINCT $cardFields, similarity(s.title, ?) AS rank
             FROM series s
             LEFT JOIN series_associated_names an ON an.series_id = s.id
             WHERE s.title ILIKE ? OR an.name ILIKE ?
             ORDER BY rank DESC
             LIMIT ? OFFSET ?"
        );
        $stmt->execute([$q, $likeTerm, $likeTerm, $perPage, ($page - 1) * $perPage]);
        $results = $stmt->fetchAll();
    } catch (PDOException $e) {
        // pg_trgm not enabled on this project — fall back to a plain match, newest first.
        $stmt = $db->prepare(
            "SELECT DISTINCT $cardFields
             FROM series s
             LEFT JOIN series_associated_names an ON an.series_id = s.id
             WHERE s.title ILIKE ? OR an.name ILIKE ?
             ORDER BY s.views DESC
             LIMIT ? OFFSET ?"
        );
        $stmt->execute([$likeTerm, $likeTerm, $perPage, ($page - 1) * $perPage]);
        $results = $stmt->fetchAll();
    }
}

$genreStmt = $db->prepare('SELECT g.name FROM genres g JOIN series_genres sg ON sg.genre_id = g.id WHERE sg.series_id = ?');

$_GET['type'] = 'novel';
$pageTitle = 'Search';
require __DIR__ . '/includes/header.php';
?>

<form class="search-box" method="get" action="search.php">
    <input type="text" name="q" value="<?= h($q) ?>" placeholder="Search titles..." autofocus>
    <button type="submit" class="btn">SEARCH</button>
</form>

<?php if ($q !== ''): ?>
    <section class="section">
        <?php if (empty($results)): ?>
            <p style="color:var(--text-muted);">No results for "<?= h($q) ?>".</p>
        <?php endif; ?>

        <?php foreach ($results as $s): ?>
            <?php render_series_card($s, $genreStmt); ?>
        <?php endforeach; ?>

        <?php if ($totalPages > 1): ?>
            <div class="pagination">
                <a href="?q=<?= urlencode($q) ?>&page=<?= max(1, $page - 1) ?>">&#9664;</a>
                <?php for ($p = 1; $p <= $totalPages; $p++): ?>
                    <a href="?q=<?= urlencode($q) ?>&page=<?= $p ?>" class="<?= $p === $page ? 'current' : '' ?>"><?= $p ?></a>
                <?php endfor; ?>
                <a href="?q=<?= urlencode($q) ?>&page=<?= min($totalPages, $page + 1) ?>">&#9654;</a>
            </div>
        <?php endif; ?>
    </section>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
