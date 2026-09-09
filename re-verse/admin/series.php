<?php
require_once __DIR__ . '/../config/config.php';
require_admin();

$db = get_db();
$classFilter = ($_GET['type'] ?? 'novel') === 'manga' ? 'manga' : 'novel';
$_GET['type'] = $classFilter; // keeps the header's NOVEL/MANGA bar in sync with this filter

$stmt = $db->prepare(
    'SELECT s.id, s.title, s.status, s.is_fanfiction, s.updated_at,
            (SELECT COUNT(*) FROM chapters c WHERE c.series_id = s.id) AS chapter_count
     FROM series s WHERE s.class = ? ORDER BY s.updated_at DESC LIMIT 200'
);
$stmt->execute([$classFilter]);
$rows = $stmt->fetchAll();

$pageTitle = 'Admin — Series';
require __DIR__ . '/../includes/header.php';
?>

<section class="section">
    <div class="admin-toolbar">
        <h2 class="section-title" style="margin:0;">SERIES — <?= strtoupper($classFilter) ?></h2>
        <a class="btn" href="add-novel.php?type=<?= h($classFilter) ?>">+ ADD NOVEL</a>
    </div>

    <table class="admin-table">
        <thead>
            <tr>
                <th>Title</th><th>Status</th>
                <th><?= $classFilter === 'manga' ? 'Comics?' : 'Fan-fiction?' ?></th>
                <th>Chapters</th><th>Updated</th><th></th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($rows as $r): ?>
            <tr>
                <td><?= h($r['title']) ?></td>
                <td><?= h(ucfirst($r['status'])) ?></td>
                <td><?= $r['is_fanfiction'] ? 'Yes' : 'No' ?></td>
                <td><?= (int)$r['chapter_count'] ?></td>
                <td><?= h(format_updated_date($r['updated_at'])) ?></td>
                <td>
                    <a class="link-action" href="view-novel.php?id=<?= (int)$r['id'] ?>">View</a>
                    <a class="link-danger" href="delete-novel.php?id=<?= (int)$r['id'] ?>">Remove</a>
                </td>
            </tr>
        <?php endforeach; ?>
        <?php if (empty($rows)): ?>
            <tr><td colspan="6" style="color:var(--text-muted);">No series yet — add the first one above.</td></tr>
        <?php endif; ?>
        </tbody>
    </table>
</section>

<?php require __DIR__ . '/../includes/footer.php'; ?>
