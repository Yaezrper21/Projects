<?php
require_once __DIR__ . '/../config/config.php';
require_admin();

$db = get_db();

$defaults = [
    'title' => '', 'description' => '', 'class' => ($_GET['type'] ?? 'novel') === 'manga' ? 'manga' : 'novel',
    'sub_format' => 'manga', 'identity' => '', 'status' => 'ongoing',
    'is_fanfiction' => false, 'genre_ids' => [], 'tags' => '', 'associated_names' => '',
];
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check($_POST['csrf_token'] ?? null)) {
        $errors[] = 'Your session expired — please try again.';
    } else {
        $defaults['title']         = trim($_POST['title'] ?? '');
        $defaults['description']   = trim($_POST['description'] ?? '');
        $defaults['class']         = ($_POST['class'] ?? 'novel') === 'manga' ? 'manga' : 'novel';
        $defaults['sub_format']    = $_POST['sub_format'] ?? 'manga';
        $defaults['identity']      = $_POST['identity'] ?? '';
        $defaults['status']        = $_POST['status'] ?? 'ongoing';
        $defaults['is_fanfiction'] = isset($_POST['is_fanfiction']);
        $defaults['genre_ids']     = array_map('intval', $_POST['genre_ids'] ?? []);
        $defaults['tags']          = $_POST['tags'] ?? '';
        $defaults['associated_names'] = $_POST['associated_names'] ?? '';

        if ($defaults['title'] === '') $errors[] = 'Title is required.';
        if (mb_strlen($defaults['title']) > 300) $errors[] = 'Title must be 300 characters or fewer.';
        if ($defaults['description'] === '') $errors[] = 'Description is required.';
        if (mb_strlen($defaults['description']) > 2000) $errors[] = 'Description must be 2000 characters or fewer.';
        if (!in_array($defaults['identity'], ['japanese', 'korean', 'chinese'], true)) $errors[] = 'Please choose a novel identity.';
        if (!in_array($defaults['status'], ['ongoing', 'completed', 'hiatus'], true)) $errors[] = 'Invalid status.';

        $coverPath = null;
        if (!empty($_FILES['cover']['name'])) {
            $coverPath = handle_image_upload($_FILES['cover'], 'covers');
            if ($coverPath === null) $errors[] = 'Cover image must be a JPG, PNG, or WEBP.';
        }

        if (empty($errors)) {
            $subFormat = $defaults['class'] === 'manga' ? $defaults['sub_format'] : null;

            $db->beginTransaction();
            try {
                $stmt = $db->prepare(
                    'INSERT INTO series (title, description, cover_image, class, sub_format, identity, status, is_fanfiction, uploaded_by)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                     RETURNING id'
                );
                $stmt->execute([
                    $defaults['title'], $defaults['description'], $coverPath,
                    $defaults['class'], $subFormat, $defaults['identity'], $defaults['status'],
                    $defaults['is_fanfiction'] ? 'true' : 'false', $_SESSION['user_id'],
                ]);
                $seriesId = (int)$stmt->fetchColumn();

                foreach ($defaults['genre_ids'] as $gid) {
                    $db->prepare('INSERT INTO series_genres (series_id, genre_id) VALUES (?, ?) ON CONFLICT DO NOTHING')
                       ->execute([$seriesId, $gid]);
                }

                foreach (preg_split('/,/', $defaults['tags']) as $tagName) {
                    $tagName = trim($tagName);
                    if ($tagName === '') continue;
                    $tagStmt = $db->prepare(
                        'INSERT INTO tags (name) VALUES (?) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id'
                    );
                    $tagStmt->execute([$tagName]);
                    $tagId = (int)$tagStmt->fetchColumn();
                    $db->prepare('INSERT INTO series_tags (series_id, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING')
                       ->execute([$seriesId, $tagId]);
                }

                foreach (preg_split('/\r\n|\r|\n/', $defaults['associated_names']) as $name) {
                    $name = trim($name);
                    if ($name === '') continue;
                    $db->prepare('INSERT INTO series_associated_names (series_id, name) VALUES (?, ?)')
                       ->execute([$seriesId, $name]);
                }

                $db->commit();
            } catch (PDOException $e) {
                $db->rollBack();
                error_log('add-novel insert failed: ' . $e->getMessage());
                $errors[] = 'Something went wrong saving this novel. Please try again.';
            }


            if (empty($errors)) {
                flash_set('"' . $defaults['title'] . '" was added.');
                redirect(BASE_URL . 'admin/view-novel.php?id=' . $seriesId);
            }
        }
    }
}

$genres = $db->query('SELECT id, name FROM genres ORDER BY name')->fetchAll();
$_GET['type'] = $defaults['class'];

$pageTitle = 'Admin — Add Novel';
require __DIR__ . '/../includes/header.php';
?>

<section class="section" style="max-width: 760px; margin: 20px auto;">
    <h2 class="section-title">ADD NOVEL</h2>

    <?php foreach ($errors as $e): ?>
        <div class="form-error" style="margin: 0 0 16px;"><?= h($e) ?></div>
    <?php endforeach; ?>

    <form method="post" action="add-novel.php" enctype="multipart/form-data">
        <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">

        <div class="admin-form-grid">
            <div class="field field-full">
                <label for="title">Title (up to 300 characters)</label>
                <input type="text" id="title" name="title" maxlength="300" required value="<?= h($defaults['title']) ?>">
            </div>

            <div class="field field-full">
                <label for="description">Description (up to 2000 characters)</label>
                <textarea id="description" name="description" maxlength="2000" required style="width:100%; min-height:120px; padding:12px 16px; border:2px solid var(--border); border-radius:var(--radius); background:var(--bg); color:var(--text); font-family:var(--font-ui);"><?= h($defaults['description']) ?></textarea>
            </div>

            <div class="field field-full">
                <label for="cover">Cover image</label>
                <input type="file" id="cover" name="cover" accept=".jpg,.jpeg,.png,.webp">
            </div>

            <div class="field">
                <label>Class</label>
                <div class="checkbox-grid">
                    <label class="checkbox-pill"><input type="radio" name="class" value="novel" <?= $defaults['class'] === 'novel' ? 'checked' : '' ?>> Novel</label>
                    <label class="checkbox-pill"><input type="radio" name="class" value="manga" <?= $defaults['class'] === 'manga' ? 'checked' : '' ?>> Manga</label>
                </div>
            </div>

            <div class="field">
                <label for="sub_format">Sub-format (manga side only)</label>
                <select id="sub_format" name="sub_format" style="width:100%; padding:10px 14px; border:2px solid var(--border); border-radius:999px; background:var(--bg); color:var(--text);">
                    <?php foreach (['manga', 'manhwa', 'manhua'] as $sf): ?>
                        <option value="<?= $sf ?>" <?= $defaults['sub_format'] === $sf ? 'selected' : '' ?>><?= ucfirst($sf) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>

            <div class="field">
                <label for="identity">Identity</label>
                <select id="identity" name="identity" required style="width:100%; padding:10px 14px; border:2px solid var(--border); border-radius:999px; background:var(--bg); color:var(--text);">
                    <option value="">Select...</option>
                    <?php foreach (['japanese', 'korean', 'chinese'] as $idv): ?>
                        <option value="<?= $idv ?>" <?= $defaults['identity'] === $idv ? 'selected' : '' ?>><?= ucfirst($idv) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>

            <div class="field">
                <label for="status">Status</label>
                <select id="status" name="status" style="width:100%; padding:10px 14px; border:2px solid var(--border); border-radius:999px; background:var(--bg); color:var(--text);">
                    <?php foreach (['ongoing', 'completed', 'hiatus'] as $st): ?>
                        <option value="<?= $st ?>" <?= $defaults['status'] === $st ? 'selected' : '' ?>><?= ucfirst($st) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>

            <div class="field">
                <label class="checkbox-pill" style="display:inline-block;">
                    <input type="checkbox" name="is_fanfiction" <?= $defaults['is_fanfiction'] ? 'checked' : '' ?>>
                    Fan-fiction / Comics (shows under that nav instead of Library)
                </label>
            </div>

            <div class="field field-full">
                <label>Genres</label>
                <div class="checkbox-grid">
                    <?php foreach ($genres as $g): ?>
                        <label class="checkbox-pill">
                            <input type="checkbox" name="genre_ids[]" value="<?= (int)$g['id'] ?>" <?= in_array((int)$g['id'], $defaults['genre_ids'], true) ? 'checked' : '' ?>>
                            <?= h($g['name']) ?>
                        </label>
                    <?php endforeach; ?>
                </div>
            </div>

            <div class="field field-full">
                <label for="tags">Tags (comma-separated)</label>
                <input type="text" id="tags" name="tags" placeholder="isekai, reincarnation, op mc" value="<?= h($defaults['tags']) ?>">
            </div>

            <div class="field field-full">
                <label for="associated_names">Associated names (one per line)</label>
                <textarea id="associated_names" name="associated_names" style="width:100%; min-height:80px; padding:12px 16px; border:2px solid var(--border); border-radius:var(--radius); background:var(--bg); color:var(--text); font-family:var(--font-ui);"><?= h($defaults['associated_names']) ?></textarea>
            </div>
        </div>

        <div class="form-actions">
            <button type="submit" class="btn">ADD NOVEL</button>
        </div>
    </form>
</section>

<?php require __DIR__ . '/../includes/footer.php'; ?>
