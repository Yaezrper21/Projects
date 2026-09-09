<?php
require_once __DIR__ . '/config/config.php';
require_login();

$db = get_db();
$uid = $_SESSION['user_id'];
$tab = ($_GET['tab'] ?? 'lists') === 'browse' ? 'browse' : 'lists';
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['create_list']) && csrf_check($_POST['csrf_token'] ?? null)) {
    $title = trim($_POST['title'] ?? '');
    $description = trim($_POST['description'] ?? '');
    $isPublic = isset($_POST['is_public']);

    if ($title === '') {
        $errors[] = 'List title is required.';
    } elseif (mb_strlen($title) > 150) {
        $errors[] = 'Title must be 150 characters or fewer.';
    } else {
        $db->prepare('INSERT INTO lists (user_id, title, description, is_public) VALUES (?, ?, ?, ?)')
           ->execute([$uid, $title, $description !== '' ? $description : null, $isPublic ? 'true' : 'false']);
        flash_set('List created.');
        redirect(BASE_URL . 'lists.php?tab=lists');
    }
}

if ($tab === 'lists') {
    $stmt = $db->prepare(
        'SELECT l.*, (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS item_count
         FROM lists l WHERE l.user_id = ? ORDER BY l.created_at DESC'
    );
    $stmt->execute([$uid]);
} else {
    $stmt = $db->prepare(
        'SELECT l.*, u.username, (SELECT COUNT(*) FROM list_items li WHERE li.list_id = l.id) AS item_count
         FROM lists l JOIN users u ON u.id = l.user_id
         WHERE l.is_public = true ORDER BY l.views DESC, l.created_at DESC LIMIT 60'
    );
    $stmt->execute();
}
$lists = $stmt->fetchAll();

$pageTitle = 'Lists';
require __DIR__ . '/includes/header.php';
?>

<section class="section">
    <div class="split-col-head">
        <div style="display:flex; gap:24px;">
            <a href="?tab=lists" style="<?= $tab === 'lists' ? 'text-decoration:underline;' : '' ?>">LISTS</a>
            <a href="?tab=browse" style="<?= $tab === 'browse' ? 'text-decoration:underline;' : '' ?>">BROWSE</a>
        </div>
    </div>

    <?php if ($tab === 'lists'): ?>
        <details class="create-list-toggle">
            <summary>+ CREATE NEW LIST</summary>
            <div class="create-list-form">
                <?php foreach ($errors as $e): ?><div class="form-error" style="margin:0 0 14px;"><?= h($e) ?></div><?php endforeach; ?>
                <form method="post" action="lists.php?tab=lists">
                    <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
                    <div class="field">
                        <label for="title">Title</label>
                        <input type="text" id="title" name="title" maxlength="150" required>
                    </div>
                    <div class="field">
                        <label for="description">Description</label>
                        <input type="text" id="description" name="description" maxlength="500">
                    </div>
                    <div class="field">
                        <label class="checkbox-pill" style="display:inline-block;">
                            <input type="checkbox" name="is_public" checked> Public (others can browse it)
                        </label>
                    </div>
                    <div class="form-actions">
                        <button type="submit" name="create_list" value="1" class="btn">CREATE LIST</button>
                    </div>
                </form>
            </div>
        </details>
    <?php endif; ?>

    <div class="list-grid" style="margin-top: 18px;">
        <?php foreach ($lists as $l): ?>
            <a class="list-card" href="list.php?id=<?= (int)$l['id'] ?>">
                <div class="list-card-cover"></div>
                <div class="list-card-title"><?= h(truncate_title($l['title'], 60)) ?></div>
                <div class="list-card-meta"><?= (int)$l['item_count'] ?> COLLECTIONS &nbsp; <?= (int)$l['views'] ?> VIEWS</div>
                <?php if ($l['description']): ?><div class="list-card-desc"><?= h(truncate_description($l['description'], 120)) ?></div><?php endif; ?>
                <?php if ($tab === 'browse'): ?><div class="list-card-owner">by <?= h($l['username']) ?></div><?php endif; ?>
            </a>
        <?php endforeach; ?>
        <?php if (empty($lists)): ?>
            <p style="color:var(--text-muted); grid-column:1/-1;">
                <?= $tab === 'lists' ? "You haven't created a list yet." : 'No public lists yet.' ?>
            </p>
        <?php endif; ?>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
