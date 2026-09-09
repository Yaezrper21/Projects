<?php
require_once __DIR__ . '/../config/config.php';
require_admin();

$db = get_db();
$id = (int)($_GET['id'] ?? 0);

$stmt = $db->prepare('SELECT * FROM series WHERE id = ?');
$stmt->execute([$id]);
$series = $stmt->fetch();

if (!$series) {
    flash_set('That series no longer exists.', 'error');
    redirect(BASE_URL . 'admin/series.php');
}

$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_check($_POST['csrf_token'] ?? null)) {

    if (isset($_POST['add_chapter'])) {
        $chapterNumber = trim($_POST['chapter_number'] ?? '');
        $chapterTitle  = trim($_POST['chapter_title'] ?? '') ?: null;

        if ($chapterNumber === '' || !is_numeric($chapterNumber)) {
            $errors[] = 'Chapter number must be a number (e.g. 12 or 12.5).';
        } else {
            $check = $db->prepare('SELECT 1 FROM chapters WHERE series_id = ? AND chapter_number = ?');
            $check->execute([$id, $chapterNumber]);
            if ($check->fetch()) {
                $errors[] = 'Chapter ' . $chapterNumber . ' already exists for this series.';
            }
        }

        $content = null;
        $imageFolder = null;

        if (empty($errors)) {
            if ($series['class'] === 'novel') {
                $content = trim($_POST['content'] ?? '');
                if ($content === '') $errors[] = 'Chapter content is required for a novel chapter.';
            } else {
                $folderRel = 'chapters/' . $id . '/' . str_replace('.', '_', $chapterNumber);
                $pageCount = handle_chapter_pages_upload($_FILES['pages'] ?? [], $folderRel);
                if ($pageCount === 0) {
                    $errors[] = 'Please upload at least one page image (JPG, PNG, or WEBP).';
                } else {
                    $imageFolder = 'assets/uploads/' . $folderRel;
                }
            }
        }

        if (empty($errors)) {
            $db->prepare(
                'INSERT INTO chapters (series_id, chapter_number, title, content, image_folder) VALUES (?, ?, ?, ?, ?)'
            )->execute([$id, $chapterNumber, $chapterTitle, $content, $imageFolder]);

            // A new chapter is a new release — reflect that on the homepage.
            $db->prepare('UPDATE series SET updated_at = now() WHERE id = ?')->execute([$id]);

            flash_set('Chapter ' . $chapterNumber . ' added.');
            redirect(BASE_URL . 'admin/view-novel.php?id=' . $id);
        }
    }

    if (isset($_POST['delete_chapter'])) {
        $chapterId = (int)($_POST['chapter_id'] ?? 0);
        $db->prepare('DELETE FROM chapters WHERE id = ? AND series_id = ?')->execute([$chapterId, $id]);
        flash_set('Chapter removed.');
        redirect(BASE_URL . 'admin/view-novel.php?id=' . $id);
    }
}

$stmt = $db->prepare('SELECT id, chapter_number, title, created_at FROM chapters WHERE series_id = ? ORDER BY chapter_number ASC');
$stmt->execute([$id]);
$chapters = $stmt->fetchAll();

$_GET['type'] = $series['class'];
$pageTitle = 'Admin — ' . $series['title'];
require __DIR__ . '/../includes/header.php';
?>

<section class="section">
    <div class="admin-toolbar">
        <div>
            <h2 class="section-title" style="margin:0 0 4px;"><?= h($series['title']) ?></h2>
            <span style="font-size:0.8rem; color:var(--text-muted);">
                <?= h(ucfirst($series['class'])) ?> · <?= h(ucfirst($series['status'])) ?> · <?= count($chapters) ?> chapters
            </span>
        </div>
        <a class="btn-outline" href="<?= BASE_URL ?>series.php?id=<?= $id ?>">VIEW PUBLIC PAGE</a>
    </div>

    <?php foreach ($errors as $e): ?>
        <div class="form-error" style="margin: 0 0 16px;"><?= h($e) ?></div>
    <?php endforeach; ?>

    <h3 style="font-size:0.85rem; letter-spacing:0.05em; margin: 24px 0 12px;">ADD CHAPTER</h3>
    <form method="post" action="view-novel.php?id=<?= $id ?>" enctype="multipart/form-data">
        <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
        <div class="admin-form-grid">
            <div class="field">
                <label for="chapter_number">Chapter number</label>
                <input type="text" id="chapter_number" name="chapter_number" required placeholder="e.g. 12 or 12.5">
            </div>
            <div class="field">
                <label for="chapter_title">Chapter title (optional)</label>
                <input type="text" id="chapter_title" name="chapter_title">
            </div>

            <?php if ($series['class'] === 'novel'): ?>
                <div class="field field-full">
                    <label for="content">Chapter content</label>
                    <textarea id="content" name="content" style="width:100%; min-height:220px; padding:12px 16px; border:2px solid var(--border); border-radius:var(--radius); background:var(--bg); color:var(--text); font-family:var(--font-ui);"></textarea>
                </div>
            <?php else: ?>
                <div class="field field-full">
                    <label for="pages">Page images (select in reading order)</label>
                    <input type="file" id="pages" name="pages[]" accept=".jpg,.jpeg,.png,.webp" multiple>
                </div>
            <?php endif; ?>
        </div>
        <div class="form-actions">
            <button type="submit" name="add_chapter" value="1" class="btn">ADD CHAPTER</button>
        </div>
    </form>

    <h3 style="font-size:0.85rem; letter-spacing:0.05em; margin: 32px 0 12px;">CHAPTERS</h3>
    <table class="admin-table">
        <thead><tr><th>#</th><th>Title</th><th>Added</th><th></th></tr></thead>
        <tbody>
        <?php foreach ($chapters as $c): ?>
            <tr>
                <td><?= format_chapter_number($c['chapter_number']) ?></td>
                <td><?= h($c['title'] ?? '—') ?></td>
                <td><?= h(format_updated_date($c['created_at'])) ?></td>
                <td>
                    <a class="link-action" href="<?= BASE_URL ?>read.php?id=<?= (int)$c['id'] ?>" target="_blank">Read</a>
                    <form method="post" action="view-novel.php?id=<?= $id ?>" style="display:inline;" onsubmit="return confirm('Remove this chapter?');">
                        <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
                        <input type="hidden" name="chapter_id" value="<?= (int)$c['id'] ?>">
                        <button type="submit" name="delete_chapter" value="1" class="link-danger" style="background:none; border:none; cursor:pointer; font-family:inherit;">Remove</button>
                    </form>
                </td>
            </tr>
        <?php endforeach; ?>
        <?php if (empty($chapters)): ?>
            <tr><td colspan="4" style="color:var(--text-muted);">No chapters yet.</td></tr>
        <?php endif; ?>
        </tbody>
    </table>
</section>

<?php require __DIR__ . '/../includes/footer.php'; ?>
