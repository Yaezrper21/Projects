<?php
require_once __DIR__ . '/config/config.php';

$db = get_db();
$chapterId = (int)($_GET['id'] ?? 0);

$stmt = $db->prepare(
    'SELECT c.*, s.id AS series_id, s.title AS series_title, s.class AS series_class
     FROM chapters c JOIN series s ON s.id = c.series_id
     WHERE c.id = ?'
);
$stmt->execute([$chapterId]);
$chapter = $stmt->fetch();

if (!$chapter) {
    http_response_code(404);
    $_GET['type'] = 'novel';
    $pageTitle = 'Not Found';
    require __DIR__ . '/includes/header.php';
    echo '<section class="section"><p>That chapter doesn\'t exist, or may have been removed.</p></section>';
    require __DIR__ . '/includes/footer.php';
    exit;
}

if (is_logged_in()) {
    $db->prepare('INSERT INTO history (user_id, series_id, chapter_id) VALUES (?, ?, ?)')
       ->execute([$_SESSION['user_id'], $chapter['series_id'], $chapter['id']]);
}

$prevStmt = $db->prepare('SELECT id, chapter_number FROM chapters WHERE series_id = ? AND chapter_number < ? ORDER BY chapter_number DESC LIMIT 1');
$prevStmt->execute([$chapter['series_id'], $chapter['chapter_number']]);
$prev = $prevStmt->fetch();

$nextStmt = $db->prepare('SELECT id, chapter_number FROM chapters WHERE series_id = ? AND chapter_number > ? ORDER BY chapter_number ASC LIMIT 1');
$nextStmt->execute([$chapter['series_id'], $chapter['chapter_number']]);
$next = $nextStmt->fetch();

$chapterLabel = 'Chapter ' . format_chapter_number($chapter['chapter_number']) . ($chapter['title'] ? ' — ' . $chapter['title'] : '');

$_GET['type'] = $chapter['series_class'];
$pageTitle = $chapter['series_title'] . ' — ' . $chapterLabel;
require __DIR__ . '/includes/header.php';
?>

<div class="reader-wrap">
    <p><a href="<?= BASE_URL ?>series.php?id=<?= (int)$chapter['series_id'] ?>">&larr; <?= h($chapter['series_title']) ?></a></p>
    <h1 class="series-title" style="-webkit-line-clamp: unset;"><?= h($chapterLabel) ?></h1>

    <?php if ($chapter['series_class'] === 'novel'): ?>
        <div class="reader-content"><?= h($chapter['content']) ?></div>
    <?php else: ?>
        <?php
        $imageDir = __DIR__ . '/' . $chapter['image_folder'];
        $files = [];
        if (is_dir($imageDir)) {
            foreach (['jpg', 'jpeg', 'png', 'webp'] as $ext) {
                $files = array_merge($files, glob($imageDir . '/*.' . $ext) ?: []);
            }
        }
        sort($files, SORT_NATURAL);
        ?>
        <div class="reader-pages">
            <?php if (empty($files)): ?>
                <p style="color: var(--text-muted);">No pages uploaded for this chapter yet.</p>
            <?php endif; ?>
            <?php foreach ($files as $f): ?>
                <div class="reader-page"><img src="<?= h(BASE_URL . $chapter['image_folder'] . '/' . basename($f)) ?>" alt="Page"></div>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>

    <div class="reader-nav">
        <?php if ($prev): ?>
            <a href="read.php?id=<?= (int)$prev['id'] ?>">&#9664; Chapter <?= format_chapter_number($prev['chapter_number']) ?></a>
        <?php else: ?>
            <span></span>
        <?php endif; ?>

        <?php if ($next): ?>
            <a href="read.php?id=<?= (int)$next['id'] ?>">Chapter <?= format_chapter_number($next['chapter_number']) ?> &#9654;</a>
        <?php endif; ?>
    </div>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
