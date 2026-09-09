<?php
require_once __DIR__ . '/config/config.php';
require_login();

$db = get_db();
$uid = $_SESSION['user_id'];
$user = current_user();

$stats = [
    'collections' => $db->prepare('SELECT COUNT(*) FROM collections WHERE user_id = ?'),
    'lists'       => $db->prepare('SELECT COUNT(*) FROM lists WHERE user_id = ?'),
    'ratings'     => $db->prepare('SELECT COUNT(*) FROM ratings WHERE user_id = ?'),
    'history'     => $db->prepare('SELECT COUNT(DISTINCT series_id) FROM history WHERE user_id = ?'),
];
$counts = [];
foreach ($stats as $key => $stmt) {
    $stmt->execute([$uid]);
    $counts[$key] = (int)$stmt->fetchColumn();
}

$joinedStmt = $db->prepare('SELECT created_at FROM users WHERE id = ?');
$joinedStmt->execute([$uid]);
$joinedAt = $joinedStmt->fetchColumn();

$pageTitle = $user['username'];
require __DIR__ . '/includes/header.php';
?>

<section class="section" style="max-width: 640px; margin: 20px auto;">
    <h2 class="section-title"><?= h($user['username']) ?></h2>
    <p style="color:var(--text-muted); font-size:0.85rem; margin-top:-8px;">
        <?= h($user['email']) ?> · Joined <?= h(format_updated_date($joinedAt)) ?>
        <?= $user['role'] === 'admin' ? ' · Admin' : '' ?>
    </p>

    <div class="series-stats" style="margin: 20px 0;">
        <div>COLLECTIONS: <strong><?= $counts['collections'] ?></strong></div>
        <div>LISTS: <strong><?= $counts['lists'] ?></strong></div>
        <div>RATINGS GIVEN: <strong><?= $counts['ratings'] ?></strong></div>
        <div>SERIES READ: <strong><?= $counts['history'] ?></strong></div>
    </div>

    <div class="filter-pills">
        <a class="filter-pill" href="<?= BASE_URL ?>collections.php">View Collections</a>
        <a class="filter-pill" href="<?= BASE_URL ?>lists.php">View Lists</a>
        <a class="filter-pill" href="<?= BASE_URL ?>settings.php">Settings</a>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
