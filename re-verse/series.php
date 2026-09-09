<?php
require_once __DIR__ . '/config/config.php';

$db = get_db();
$id = (int)($_GET['id'] ?? 0);

$stmt = $db->prepare(
    'SELECT s.*,
            (SELECT COUNT(*) FROM chapters c WHERE c.series_id = s.id) AS chapter_count,
            (SELECT COUNT(*) FROM collections co WHERE co.series_id = s.id) AS collection_count,
            (SELECT ROUND(AVG(score),1) FROM ratings r WHERE r.series_id = s.id) AS avg_rating,
            (SELECT COUNT(*) FROM ratings r WHERE r.series_id = s.id) AS rating_count
     FROM series s WHERE s.id = ?'
);
$stmt->execute([$id]);
$series = $stmt->fetch();

if (!$series) {
    http_response_code(404);
    $_GET['type'] = 'novel';
    $pageTitle = 'Not Found';
    require __DIR__ . '/includes/header.php';
    echo '<section class="section"><p>That series doesn\'t exist, or may have been removed.</p></section>';
    require __DIR__ . '/includes/footer.php';
    exit;
}

/* ---------------------------------------------------------------
 * POST handlers: toggle collection, submit/update rating
 * ------------------------------------------------------------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_check($_POST['csrf_token'] ?? null)) {
    if (!is_logged_in()) {
        redirect(BASE_URL . 'login.php');
    }
    $uid = $_SESSION['user_id'];

    if (isset($_POST['toggle_collection'])) {
        $check = $db->prepare('SELECT 1 FROM collections WHERE user_id = ? AND series_id = ?');
        $check->execute([$uid, $id]);
        if ($check->fetch()) {
            $db->prepare('DELETE FROM collections WHERE user_id = ? AND series_id = ?')->execute([$uid, $id]);
        } else {
            $db->prepare('INSERT INTO collections (user_id, series_id) VALUES (?, ?)')->execute([$uid, $id]);
        }
        redirect(BASE_URL . 'series.php?id=' . $id);
    }

    if (isset($_POST['submit_rating'])) {
        $score = max(1, min(10, (int)($_POST['score'] ?? 0)));
        $comment = trim($_POST['comment'] ?? '');
        $db->prepare(
            'INSERT INTO ratings (user_id, series_id, score, comment)
             VALUES (?, ?, ?, ?)
             ON CONFLICT (user_id, series_id)
             DO UPDATE SET score = EXCLUDED.score, comment = EXCLUDED.comment, created_at = now()'
        )->execute([$uid, $id, $score, $comment !== '' ? $comment : null]);
        redirect(BASE_URL . 'series.php?id=' . $id . '#ratings');
    }

    if (isset($_POST['add_to_list'])) {
        $listId = (int)($_POST['list_id'] ?? 0);
        // Scoped via EXISTS so a series can only land in a list the
        // current user actually owns, regardless of what list_id is posted.
        $db->prepare(
            'INSERT INTO list_items (list_id, series_id)
             SELECT ?, ? WHERE EXISTS (SELECT 1 FROM lists WHERE id = ? AND user_id = ?)
             ON CONFLICT DO NOTHING'
        )->execute([$listId, $id, $listId, $uid]);
        flash_set('Added to list.');
        redirect(BASE_URL . 'series.php?id=' . $id);
    }
}

/* Make the header's NOVEL/MANGA bar reflect this series' own class. */
$_GET['type'] = $series['class'];

/* ---------------------------------------------------------------
 * Genres, tags, associated names
 * ------------------------------------------------------------- */
$genreStmt = $db->prepare('SELECT g.name FROM genres g JOIN series_genres sg ON sg.genre_id = g.id WHERE sg.series_id = ?');
$genreStmt->execute([$id]);
$genres = array_column($genreStmt->fetchAll(), 'name');

$tagStmt = $db->prepare('SELECT t.name FROM tags t JOIN series_tags st ON st.tag_id = t.id WHERE st.series_id = ?');
$tagStmt->execute([$id]);
$tags = array_column($tagStmt->fetchAll(), 'name');

$namesStmt = $db->prepare('SELECT name FROM series_associated_names WHERE series_id = ? ORDER BY id');
$namesStmt->execute([$id]);
$associatedNames = array_column($namesStmt->fetchAll(), 'name');

/* ---------------------------------------------------------------
 * Chapters: ascending/descending + pagination (10 per page)
 * ------------------------------------------------------------- */
$sort = ($_GET['sort'] ?? 'descending') === 'ascending' ? 'ASC' : 'DESC';
$chapPage = max(1, (int)($_GET['chap_page'] ?? 1));
$chapPerPage = 10;
$totalChapters = (int)$series['chapter_count'];
$totalChapPages = max(1, (int)ceil($totalChapters / $chapPerPage));
$chapPage = min($chapPage, $totalChapPages);

$stmt = $db->prepare(
    "SELECT id, chapter_number, title FROM chapters WHERE series_id = ?
     ORDER BY chapter_number $sort
     LIMIT ? OFFSET ?"
);
$stmt->execute([$id, $chapPerPage, ($chapPage - 1) * $chapPerPage]);
$chapters = $stmt->fetchAll();

/* ---------------------------------------------------------------
 * Is this series already in the current user's collection?
 * Does the current user already have a rating on it?
 * ------------------------------------------------------------- */
$inCollection = false;
$myRating = null;
$myLists = [];
if (is_logged_in()) {
    $check = $db->prepare('SELECT 1 FROM collections WHERE user_id = ? AND series_id = ?');
    $check->execute([$_SESSION['user_id'], $id]);
    $inCollection = (bool)$check->fetch();

    $check = $db->prepare('SELECT score, comment FROM ratings WHERE user_id = ? AND series_id = ?');
    $check->execute([$_SESSION['user_id'], $id]);
    $myRating = $check->fetch() ?: null;

    $listsStmt = $db->prepare('SELECT id, title FROM lists WHERE user_id = ? ORDER BY title');
    $listsStmt->execute([$_SESSION['user_id']]);
    $myLists = $listsStmt->fetchAll();
}

/* ---------------------------------------------------------------
 * Ratings & comments feed
 * ------------------------------------------------------------- */
$stmt = $db->prepare(
    'SELECT r.score, r.comment, r.created_at, u.username
     FROM ratings r JOIN users u ON u.id = r.user_id
     WHERE r.series_id = ? ORDER BY r.created_at DESC LIMIT 20'
);
$stmt->execute([$id]);
$comments = $stmt->fetchAll();

/* ---------------------------------------------------------------
 * Recommendations
 * ------------------------------------------------------------- */
$recommendations = get_recommendations($db, $id, $series['class'], $series['title']);

/* Bump the view counter — once per page load is a reasonable, simple rule here. */
$db->prepare('UPDATE series SET views = views + 1 WHERE id = ?')->execute([$id]);

$pageTitle = $series['title'];
require __DIR__ . '/includes/header.php';
?>

<div class="series-layout">
    <!-- Left: cover, add-to-collection, stats, associated names -->
    <div>
        <div class="series-cover">
            <?php if ($series['cover_image']): ?>
                <img src="<?= h(BASE_URL . $series['cover_image']) ?>" alt="<?= h($series['title']) ?>">
            <?php endif; ?>
        </div>

        <form method="post" action="series.php?id=<?= $id ?>">
            <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
            <button type="submit" name="toggle_collection" value="1" class="btn collection-btn">
                <?= $inCollection ? 'REMOVE FROM COLLECTION' : 'ADD SERIES TO +' ?>
            </button>
        </form>

        <?php if (is_logged_in()): ?>
            <form method="post" action="series.php?id=<?= $id ?>" class="add-to-list-form">
                <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
                <?php if ($myLists): ?>
                    <select name="list_id">
                        <?php foreach ($myLists as $l): ?>
                            <option value="<?= (int)$l['id'] ?>"><?= h($l['title']) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <button type="submit" name="add_to_list" value="1">ADD TO LIST</button>
                <?php else: ?>
                    <span style="font-size:0.78rem; color:var(--text-muted);">
                        <a href="<?= BASE_URL ?>lists.php">Create a list</a> to save this there.
                    </span>
                <?php endif; ?>
            </form>
        <?php endif; ?>

        <div class="series-stats">
            <div>VIEWS: <strong><?= number_format((int)$series['views'] + 1) ?></strong></div>
            <div>COLLECTIONS: <strong><?= number_format((int)$series['collection_count']) ?></strong></div>
            <div>RATINGS: <strong><?= $series['avg_rating'] !== null ? h((string)$series['avg_rating']) : '—' ?>/10</strong>
                (<?= (int)$series['rating_count'] ?>)</div>
        </div>

        <?php if ($associatedNames): ?>
            <div class="associated-names">
                <h4>Associated Names</h4>
                <?php foreach ($associatedNames as $n): ?>
                    <div><?= h($n) ?></div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>

    <!-- Middle: title, description, genres, tags -->
    <div>
        <h1 class="series-title"><?= h(novel_page_title($series['title'])) ?></h1>
        <p class="series-description"><?= h(novel_page_description($series['description'])) ?></p>

        <?php if ($genres): ?>
            <div class="badge-group">
                <h4>Genre</h4>
                <?php foreach ($genres as $g): ?><span class="genre-badge"><?= h($g) ?></span><?php endforeach; ?>
            </div>
        <?php endif; ?>

        <?php if ($tags): ?>
            <div class="badge-group">
                <h4>Tags</h4>
                <?php foreach ($tags as $t): ?><span class="tag-badge"><?= h($t) ?></span><?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>

    <!-- Right: chapters (TOS) -->
    <div class="chapters-panel">
        <div class="chapters-panel-head">
            <a class="sort-toggle <?= $sort === 'ASC' ? 'active' : '' ?>" href="?id=<?= $id ?>&sort=ascending">ASCENDING</a>
            <span>TOS</span>
            <a class="sort-toggle <?= $sort === 'DESC' ? 'active' : '' ?>" href="?id=<?= $id ?>&sort=descending">DESCENDING</a>
        </div>

        <?php if (empty($chapters)): ?>
            <p style="color: var(--text-muted); font-size: 0.85rem;">No chapters yet.</p>
        <?php endif; ?>

        <?php foreach ($chapters as $c): ?>
            <a class="chapter-row" href="read.php?id=<?= (int)$c['id'] ?>">
                Chapter <?= format_chapter_number($c['chapter_number']) ?><?= $c['title'] ? ' — ' . h($c['title']) : '' ?>
            </a>
        <?php endforeach; ?>

        <?php if ($totalChapPages > 1): ?>
            <div class="pagination" style="margin-top:14px;">
                <a href="?id=<?= $id ?>&sort=<?= h($_GET['sort'] ?? 'descending') ?>&chap_page=<?= max(1, $chapPage - 1) ?>">&#9664;</a>
                <?php for ($p = 1; $p <= $totalChapPages; $p++): ?>
                    <a href="?id=<?= $id ?>&sort=<?= h($_GET['sort'] ?? 'descending') ?>&chap_page=<?= $p ?>" class="<?= $p === $chapPage ? 'current' : '' ?>"><?= $p ?></a>
                <?php endfor; ?>
                <a href="?id=<?= $id ?>&sort=<?= h($_GET['sort'] ?? 'descending') ?>&chap_page=<?= min($totalChapPages, $chapPage + 1) ?>">&#9654;</a>
            </div>
        <?php endif; ?>
    </div>
</div>

<!-- Recommendations -->
<section class="section">
    <h2 class="section-title">RECOMMENDATIONS</h2>
    <?php if (empty($recommendations)): ?>
        <p style="color: var(--text-muted); font-size:0.85rem;">Not enough data yet to recommend similar series.</p>
    <?php else: ?>
        <div class="recommend-list">
            <?php foreach ($recommendations as $r): ?>
                <a class="recommend-item" href="series.php?id=<?= (int)$r['id'] ?>">
                    <div class="recommend-cover">
                        <?php if (!empty($r['cover_image'])): ?>
                            <img src="<?= h(BASE_URL . $r['cover_image']) ?>" alt="">
                        <?php endif; ?>
                    </div>
                    <div class="recommend-title"><?= h(popular_title($r['title'])) ?></div>
                </a>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</section>

<!-- Ratings & comments -->
<section class="section" id="ratings">
    <h2 class="section-title">RATINGS</h2>

    <?php if (is_logged_in()): ?>
        <form class="rating-form" method="post" action="series.php?id=<?= $id ?>#ratings">
            <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">
            <div class="field">
                <label for="score">Your score</label>
                <select id="score" name="score">
                    <?php for ($i = 10; $i >= 1; $i--): ?>
                        <option value="<?= $i ?>" <?= ($myRating['score'] ?? null) == $i ? 'selected' : '' ?>><?= $i ?>/10</option>
                    <?php endfor; ?>
                </select>
            </div>
            <div class="field">
                <label for="comment">Comment</label>
                <textarea id="comment" name="comment" maxlength="1000" placeholder="What did you think?"><?= h($myRating['comment'] ?? '') ?></textarea>
            </div>
            <button type="submit" name="submit_rating" value="1" class="btn"><?= $myRating ? 'UPDATE RATING' : 'SUBMIT RATING' ?></button>
        </form>
    <?php else: ?>
        <p><a href="<?= BASE_URL ?>login.php">Log in</a> to rate and comment on this series.</p>
    <?php endif; ?>

    <div style="margin-top: 24px;">
        <?php if (empty($comments)): ?>
            <p style="color: var(--text-muted); font-size:0.85rem;">No ratings yet — be the first.</p>
        <?php endif; ?>
        <?php foreach ($comments as $c): ?>
            <div class="comment-card">
                <div class="comment-head">
                    <span><?= h($c['username']) ?></span>
                    <span class="comment-score"><?= (int)$c['score'] ?>/10</span>
                </div>
                <?php if ($c['comment']): ?><div class="comment-body"><?= h($c['comment']) ?></div><?php endif; ?>
            </div>
        <?php endforeach; ?>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
