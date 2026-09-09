<?php
require_once __DIR__ . '/../config/config.php';
require_admin();

$db = get_db();
$id = (int)($_GET['id'] ?? $_POST['id'] ?? 0);

$stmt = $db->prepare('SELECT id, title, class FROM series WHERE id = ?');
$stmt->execute([$id]);
$series = $stmt->fetch();

if (!$series) {
    flash_set('That series no longer exists.', 'error');
    redirect(BASE_URL . 'admin/series.php');
}

$step = 1;
if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_check($_POST['csrf_token'] ?? null)) {
    $step = (int)($_POST['step'] ?? 1);

    if ($step === 2) {
        $step = 2; // show the final confirmation screen
    } elseif ($step === 3) {
        $db->prepare('DELETE FROM series WHERE id = ?')->execute([$id]);
        flash_set('"' . $series['title'] . '" and all its chapters were removed.');
        redirect(BASE_URL . 'admin/series.php');
    }
}

$_GET['type'] = $series['class'];
$pageTitle = 'Remove Series';
require __DIR__ . '/../includes/header.php';
?>

<div class="confirm-box">
    <?php if ($step === 1): ?>
        <h2 class="section-title">REMOVE SERIES?</h2>
        <p>Are you sure you want to remove <strong><?= h($series['title']) ?></strong>? This will also remove all of
           its chapters, ratings, and collection/list entries.</p>
        <form method="post" action="delete-novel.php?id=<?= $id ?>" class="confirm-actions">
            <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
            <input type="hidden" name="step" value="2">
            <a class="btn-outline" href="view-novel.php?id=<?= $id ?>">Cancel</a>
            <button type="submit" class="btn">Yes, remove it</button>
        </form>
    <?php else: ?>
        <h2 class="section-title">ARE YOU REALLY SURE?</h2>
        <p>This is permanent — <strong><?= h($series['title']) ?></strong> and everything attached to it will be
           deleted and cannot be recovered. Confirm one more time to proceed.</p>
        <form method="post" action="delete-novel.php?id=<?= $id ?>" class="confirm-actions">
            <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
            <input type="hidden" name="step" value="3">
            <a class="btn-outline" href="view-novel.php?id=<?= $id ?>">Cancel</a>
            <button type="submit" class="btn" style="background: var(--accent); border-color: var(--accent);">Yes, permanently remove it</button>
        </form>
    <?php endif; ?>
</div>

<?php require __DIR__ . '/../includes/footer.php'; ?>
