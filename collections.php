<?php
require_once __DIR__ . '/config/config.php';
require_login();

$type = ($_GET['type'] ?? 'novel') === 'manga' ? 'manga' : 'novel';
$statusFilter = in_array($_GET['status'] ?? '', ['ongoing', 'completed'], true) ? $_GET['status'] : 'all';

$db = get_db();
$uid = $_SESSION['user_id'];

$statusSql = $statusFilter !== 'all' ? ' AND s.status = ?' : '';
$statusParam = $statusFilter !== 'all' ? [$statusFilter] : [];

$cardFields = "s.id, s.title, s.description, s.cover_image, s.status, s.updated_at, s.identity,
    (SELECT COUNT(*) FROM chapters c WHERE c.series_id = s.id) AS chapter_count,
    (SELECT COUNT(*) FROM collections co WHERE co.series_id = s.id) AS collection_count,
    (SELECT ROUND(AVG(score),1) FROM ratings r WHERE r.series_id = s.id) AS avg_rating";

$collStmt = $db->prepare(
    "SELECT $cardFields
     FROM series s JOIN collections c ON c.series_id = s.id
     WHERE c.user_id = ? AND s.class = ?$statusSql
     ORDER BY s.updated_at DESC LIMIT 30"
);
$collStmt->execute(array_merge([$uid, $type], $statusParam));
$collectionItems = $collStmt->fetchAll();

$histStmt = $db->prepare(
    "SELECT $cardFields
     FROM series s
     JOIN (SELECT series_id, MAX(viewed_at) AS last_viewed FROM history WHERE user_id = ? GROUP BY series_id) h
       ON h.series_id = s.id
     WHERE s.class = ?$statusSql
     ORDER BY h.last_viewed DESC LIMIT 30"
);
$histStmt->execute(array_merge([$uid, $type], $statusParam));
$historyItems = $histStmt->fetchAll();

$genreStmt = $db->prepare('SELECT g.name FROM genres g JOIN series_genres sg ON sg.genre_id = g.id WHERE sg.series_id = ?');

$pageTitle = 'Collections';
require __DIR__ . '/includes/header.php';
?>

<section class="section">
    <div class="split-col-head" style="margin-bottom: 4px;">
        <span></span>
        <details class="filter-dropdown">
            <summary>FILTER</summary>
            <div class="filter-dropdown-menu">
                <div class="filter-pills" style="flex-direction:column; align-items:stretch;">
                    <a class="filter-pill <?= $statusFilter === 'all' ? 'active' : '' ?>" style="text-align:center;" href="?type=<?= h($type) ?>">All</a>
                    <a class="filter-pill <?= $statusFilter === 'ongoing' ? 'active' : '' ?>" style="text-align:center;" href="?type=<?= h($type) ?>&status=ongoing">Ongoing</a>
                    <a class="filter-pill <?= $statusFilter === 'completed' ? 'active' : '' ?>" style="text-align:center;" href="?type=<?= h($type) ?>&status=completed">Completed</a>
                </div>
            </div>
        </details>
    </div>

    <div class="split-columns">
        <div>
            <div class="split-col-head"><span>COLLECTIONS</span></div>
            <?php if (empty($collectionItems)): ?>
                <p style="color:var(--text-muted); font-size:0.85rem;">Nothing in your collection yet — add series from their page.</p>
            <?php endif; ?>
            <?php foreach ($collectionItems as $s): ?>
                <?php render_series_card($s, $genreStmt); ?>
            <?php endforeach; ?>
        </div>
        <div>
            <div class="split-col-head"><span>HISTORY</span></div>
            <?php if (empty($historyItems)): ?>
                <p style="color:var(--text-muted); font-size:0.85rem;">Nothing read yet.</p>
            <?php endif; ?>
            <?php foreach ($historyItems as $s): ?>
                <?php render_series_card($s, $genreStmt); ?>
            <?php endforeach; ?>
        </div>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
