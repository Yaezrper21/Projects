<?php
require_once __DIR__ . '/config/config.php';

$db = get_db();
$id = (int)($_GET['id'] ?? 0);

$stmt = $db->prepare('SELECT l.*, u.username FROM lists l JOIN users u ON u.id = l.user_id WHERE l.id = ?');
$stmt->execute([$id]);
$list = $stmt->fetch();

if (!$list) {
    http_response_code(404);
    $_GET['type'] = 'novel';
    $pageTitle = 'Not Found';
    require __DIR__ . '/includes/header.php';
    echo '<section class="section"><p>That list doesn\'t exist, or may have been removed.</p></section>';
    require __DIR__ . '/includes/footer.php';
    exit;
}

$isOwner = is_logged_in() && (int)$_SESSION['user_id'] === (int)$list['user_id'];

if (!$list['is_public'] && !$isOwner) {
    http_response_code(403);
    $_GET['type'] = 'novel';
    $pageTitle = 'Private List';
    require __DIR__ . '/includes/header.php';
    echo '<section class="section"><p>This list is private.</p></section>';
    require __DIR__ . '/includes/footer.php';
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $isOwner && csrf_check($_POST['csrf_token'] ?? null)) {
    if (isset($_POST['remove_item'])) {
        $db->prepare('DELETE FROM list_items WHERE list_id = ? AND series_id = ?')
           ->execute([$id, (int)($_POST['series_id'] ?? 0)]);
        redirect(BASE_URL . 'list.php?id=' . $id);
    }
}

if (!$isOwner) {
    $db->prepare('UPDATE lists SET views = views + 1 WHERE id = ?')->execute([$id]);
}

$itemsStmt = $db->prepare(
    "SELECT s.id, s.title, s.description, s.cover_image, s.status, s.updated_at, s.identity,
            (SELECT COUNT(*) FROM chapters c WHERE c.series_id = s.id) AS chapter_count,
            (SELECT COUNT(*) FROM collections co WHERE co.series_id = s.id) AS collection_count,
            (SELECT ROUND(AVG(score),1) FROM ratings r WHERE r.series_id = s.id) AS avg_rating
     FROM series s JOIN list_items li ON li.series_id = s.id
     WHERE li.list_id = ? ORDER BY li.added_at DESC"
);
$itemsStmt->execute([$id]);
$items = $itemsStmt->fetchAll();

$genreStmt = $db->prepare('SELECT g.name FROM genres g JOIN series_genres sg ON sg.genre_id = g.id WHERE sg.series_id = ?');

$_GET['type'] = 'novel';
$pageTitle = $list['title'];
require __DIR__ . '/includes/header.php';
?>

<section class="section">
    <div class="split-col-head">
        <div>
            <h2 class="section-title" style="margin:0 0 4px;"><?= h($list['title']) ?></h2>
            <span style="font-size:0.8rem; color:var(--text-muted);">
                by <?= h($list['username']) ?> · <?= count($items) ?> series · <?= (int)$list['views'] ?> views
                <?= $list['is_public'] ? '' : ' · Private' ?>
            </span>
        </div>
        <a href="<?= BASE_URL ?>lists.php?tab=<?= $isOwner ? 'lists' : 'browse' ?>">&larr; Back to lists</a>
    </div>

    <?php if ($list['description']): ?><p style="margin: 12px 0 20px;"><?= h($list['description']) ?></p><?php endif; ?>

    <?php if (empty($items)): ?>
        <p style="color:var(--text-muted);">No series in this list yet<?= $isOwner ? ' — add some from any series page.' : '.' ?></p>
    <?php endif; ?>

    <?php foreach ($items as $s): ?>
        <?php if ($isOwner): ?>
            <form method="post" action="list.php?id=<?= $id ?>" style="display:flex; align-items:center; gap:12px;">
                <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
                <input type="hidden" name="series_id" value="<?= (int)$s['id'] ?>">
                <div style="flex:1;"><?php render_series_card($s, $genreStmt); ?></div>
                <button type="submit" name="remove_item" value="1" class="link-danger" style="background:none; border:none; cursor:pointer; font-family:inherit;">Remove</button>
            </form>
        <?php else: ?>
            <?php render_series_card($s, $genreStmt); ?>
        <?php endif; ?>
    <?php endforeach; ?>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
