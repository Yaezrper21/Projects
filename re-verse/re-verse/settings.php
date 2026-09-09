<?php
require_once __DIR__ . '/config/config.php';
require_login();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_check($_POST['csrf_token'] ?? null)) {
    $_SESSION['theme'] = ($_POST['theme'] ?? 'light') === 'dark' ? 'dark' : 'light';
    redirect(BASE_URL . 'settings.php');
}

$theme = $_SESSION['theme'] ?? 'light';
$pageTitle = 'Settings';
require __DIR__ . '/includes/header.php';
?>

<section class="section" style="max-width: 480px; margin: 20px auto;">
    <h2 class="section-title">SETTINGS</h2>

    <form method="post" action="settings.php">
        <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">

        <div class="field">
            <label for="theme">Theme</label>
            <select id="theme" name="theme" style="width:100%; padding:10px 14px; border:2px solid var(--border); border-radius:999px; background:var(--bg); color:var(--text);" onchange="this.form.submit()">
                <option value="light" <?= $theme === 'light' ? 'selected' : '' ?>>Light mode</option>
                <option value="dark" <?= $theme === 'dark' ? 'selected' : '' ?>>Dark mode</option>
            </select>
        </div>
    </form>

    <p style="margin-top:24px;"><a href="<?= BASE_URL ?>logout.php" class="btn" style="display:inline-block;">LOG OUT</a></p>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
