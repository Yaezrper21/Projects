<?php
// Expects config/config.php to already be included by the calling page,
// and the following set: $listingTitle, $genreTypeFilter,
// $showIdentityFilter, $isFanfictionFilter, $seriesClass, $baseAction

$_GET['type'] = $seriesClass;
$db = get_db();

$orderByMap = [
    'name'        => 's.title',
    'latest'      => 's.updated_at',
    'collections' => 'collection_count',
    'views'       => 's.views',
    'chapters'    => 'chapter_count',
];
$orderByRaw = is_string($_GET['order_by'] ?? null) ? $_GET['order_by'] : '';
$orderByKey = array_key_exists($orderByRaw, $orderByMap) ? $orderByRaw : 'latest';
$orderDir = ($_GET['order'] ?? 'descending') === 'ascending' ? 'ASC' : 'DESC';

$statusFilter = in_array($_GET['status'] ?? '', ['ongoing', 'completed'], true) ? $_GET['status'] : 'all';
$identityFilter = ($showIdentityFilter && in_array($_GET['identity'] ?? '', ['japanese', 'korean', 'chinese'], true))
    ? $_GET['identity'] : 'all';
$selectedGenres = array_values(array_unique(array_map('intval', $_GET['genre'] ?? [])));
$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = 10;

$where = ['s.class = ?', 's.is_fanfiction = ?'];
$params = [$seriesClass, $isFanfictionFilter ? 'true' : 'false'];

if ($statusFilter !== 'all') {
    $where[] = 's.status = ?';
    $params[] = $statusFilter;
}
if ($identityFilter !== 'all') {
    $where[] = 's.identity = ?';
    $params[] = $identityFilter;
}
if ($selectedGenres) {
    $placeholders = implode(',', array_fill(0, count($selectedGenres), '?'));
    $where[] = "s.id IN (SELECT series_id FROM series_genres WHERE genre_id IN ($placeholders) GROUP BY series_id HAVING COUNT(DISTINCT genre_id) = ?)";
    foreach ($selectedGenres as $gid) { $params[] = $gid; }
    $params[] = count($selectedGenres);
}
$whereSql = implode(' AND ', $where);

$countStmt = $db->prepare("SELECT COUNT(*) FROM series s WHERE $whereSql");
$countStmt->execute($params);
$totalResults = (int)$countStmt->fetchColumn();
$totalPages = max(1, (int)ceil($totalResults / $perPage));
$page = min($page, $totalPages);

$sql = "SELECT s.id, s.title, s.description, s.cover_image, s.status, s.updated_at, s.identity,
               (SELECT COUNT(*) FROM chapters c WHERE c.series_id = s.id) AS chapter_count,
               (SELECT COUNT(*) FROM collections co WHERE co.series_id = s.id) AS collection_count,
               (SELECT ROUND(AVG(score),1) FROM ratings r WHERE r.series_id = s.id) AS avg_rating
        FROM series s
        WHERE $whereSql
        ORDER BY {$orderByMap[$orderByKey]} $orderDir
        LIMIT ? OFFSET ?";
$stmt = $db->prepare($sql);
$stmt->execute(array_merge($params, [$perPage, ($page - 1) * $perPage]));
$results = $stmt->fetchAll();

$genreStmt = $db->prepare('SELECT g.name FROM genres g JOIN series_genres sg ON sg.genre_id = g.id WHERE sg.series_id = ?');

$sidebarGenreStmt = $db->prepare('SELECT id, name FROM genres WHERE genre_type = ? ORDER BY name');
$sidebarGenreStmt->execute([$genreTypeFilter]);
$sidebarGenres = $sidebarGenreStmt->fetchAll();

$pageTitle = ucfirst($seriesClass) . ' — ' . $listingTitle;
require __DIR__ . '/header.php';
?>

<div class="listing-layout">
    <aside class="filter-sidebar">
        <h3 class="section-title" style="margin-bottom:18px;"><?= h($listingTitle) ?></h3>

        <div class="filter-group">
            <h4>Order By</h4>
            <div class="filter-pills">
                <?php foreach (['name' => 'Name', 'latest' => 'Latest', 'collections' => 'Collections', 'views' => 'Views', 'chapters' => 'Chapters'] as $key => $label): ?>
                    <a class="filter-pill <?= $orderByKey === $key ? 'active' : '' ?>" href="<?= h(listing_link($baseAction, ['order_by' => $key])) ?>"><?= $label ?></a>
                <?php endforeach; ?>
            </div>
        </div>

        <div class="filter-group">
            <h4>Order</h4>
            <div class="filter-pills">
                <a class="filter-pill <?= $orderDir === 'ASC' ? 'active' : '' ?>" href="<?= h(listing_link($baseAction, ['order' => 'ascending'])) ?>">Ascending</a>
                <a class="filter-pill <?= $orderDir === 'DESC' ? 'active' : '' ?>" href="<?= h(listing_link($baseAction, ['order' => 'descending'])) ?>">Descending</a>
            </div>
        </div>

        <div class="filter-group">
            <h4>Status</h4>
            <div class="filter-pills">
                <a class="filter-pill <?= $statusFilter === 'all' ? 'active' : '' ?>" href="<?= h(listing_link($baseAction, ['status' => null])) ?>">All</a>
                <a class="filter-pill <?= $statusFilter === 'ongoing' ? 'active' : '' ?>" href="<?= h(listing_link($baseAction, ['status' => 'ongoing'])) ?>">Ongoing</a>
                <a class="filter-pill <?= $statusFilter === 'completed' ? 'active' : '' ?>" href="<?= h(listing_link($baseAction, ['status' => 'completed'])) ?>">Completed</a>
            </div>
        </div>

        <div class="filter-group">
            <h4>Genre</h4>
            <div class="filter-pills">
                <a class="filter-pill <?= empty($selectedGenres) ? 'active' : '' ?>" href="<?= h(listing_link($baseAction, ['genre' => null])) ?>">All</a>
                <?php foreach ($sidebarGenres as $g): ?>
                    <a class="filter-pill <?= in_array((int)$g['id'], $selectedGenres, true) ? 'active' : '' ?>" href="<?= h(genre_toggle_link($baseAction, $selectedGenres, (int)$g['id'])) ?>"><?= h($g['name']) ?></a>
                <?php endforeach; ?>
            </div>
        </div>

        <a class="filter-clear" href="<?= h($baseAction) ?>?type=<?= h($seriesClass) ?>">Clear</a>
    </aside>

    <div>
        <?php if ($showIdentityFilter): ?>
            <div class="identity-tabs">
                <a class="<?= $identityFilter === 'all' ? 'active' : '' ?>" href="<?= h(listing_link($baseAction, ['identity' => null])) ?>">All</a>
                <a class="<?= $identityFilter === 'japanese' ? 'active' : '' ?>" href="<?= h(listing_link($baseAction, ['identity' => 'japanese'])) ?>">Japanese</a>
                <a class="<?= $identityFilter === 'korean' ? 'active' : '' ?>" href="<?= h(listing_link($baseAction, ['identity' => 'korean'])) ?>">Korean</a>
                <a class="<?= $identityFilter === 'chinese' ? 'active' : '' ?>" href="<?= h(listing_link($baseAction, ['identity' => 'chinese'])) ?>">Chinese</a>
            </div>
        <?php endif; ?>

        <div class="results-panel">
            <?php if (empty($results)): ?>
                <p style="color:var(--text-muted);">Nothing matches these filters yet.</p>
            <?php endif; ?>

            <?php foreach ($results as $s): ?>
                <?php render_series_card($s, $genreStmt); ?>
            <?php endforeach; ?>

            <?php if ($totalPages > 1): ?>
                <div class="pagination">
                    <a href="<?= h(listing_link($baseAction, ['page' => max(1, $page - 1)])) ?>">&#9664;</a>
                    <?php for ($p = 1; $p <= $totalPages; $p++): ?>
                        <a href="<?= h(listing_link($baseAction, ['page' => $p])) ?>" class="<?= $p === $page ? 'current' : '' ?>"><?= $p ?></a>
                    <?php endfor; ?>
                    <a href="<?= h(listing_link($baseAction, ['page' => min($totalPages, $page + 1)])) ?>">&#9654;</a>
                </div>
            <?php endif; ?>
        </div>
    </div>
</div>

<?php require __DIR__ . '/footer.php'; ?>
