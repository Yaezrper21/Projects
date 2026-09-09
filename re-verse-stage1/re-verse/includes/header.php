<?php
// Expects config/config.php to already be included by the calling page.

$type = ($_GET['type'] ?? 'novel') === 'manga' ? 'manga' : 'novel';

/** Builds a link that preserves the current query string but swaps `type`. */
function type_link(string $type): string
{
    $params = $_GET;
    $params['type'] = $type;
    return BASE_URL . basename($_SERVER['PHP_SELF']) . '?' . http_build_query($params);
}

/** Gate: search & settings require login; otherwise go straight through. */
function gated_link(string $target): string
{
    return is_logged_in() ? $target : BASE_URL . 'login.php';
}
?>
<!DOCTYPE html>
<html lang="en" data-theme="<?= h($_SESSION['theme'] ?? 'light') ?>">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= isset($pageTitle) ? h($pageTitle) . ' — ' : '' ?><?= SITE_NAME ?></title>
<link rel="stylesheet" href="<?= BASE_URL ?>assets/css/style.css">
</head>
<body>

<header class="site-header">
    <div class="type-toggle">
        <a href="<?= h(type_link('novel')) ?>" class="type-half <?= $type === 'novel' ? 'active' : '' ?>">NOVEL</a>
        <a href="<?= h(type_link('manga')) ?>" class="type-half <?= $type === 'manga' ? 'active' : '' ?>">MANGA</a>
    </div>

    <nav class="main-nav">
        <a href="<?= BASE_URL ?>index.php?type=<?= h($type) ?>" class="brand">RE-VERSE</a>

        <a href="<?= h(gated_link(BASE_URL . 'search.php')) ?>" class="nav-pill">&#128269; SEARCH</a>

        <?php if (is_logged_in()): ?>
            <div class="nav-links">
                <a href="<?= BASE_URL ?>fan-fiction.php"><?= $type === 'manga' ? 'COMICS' : 'FAN-FICTION' ?></a>
                <a href="<?= BASE_URL ?>library.php?type=<?= h($type) ?>">LIBRARY</a>
                <a href="<?= BASE_URL ?>lists.php">LISTS</a>
                <a href="<?= BASE_URL ?>collections.php">COLLECTIONS</a>
                <a href="<?= BASE_URL ?>user.php"><?= h($_SESSION['username']) ?></a>
            </div>
            <a href="<?= BASE_URL ?>settings.php" class="settings-icon" title="Settings">&#9881;</a>
        <?php else: ?>
            <a href="<?= BASE_URL ?>login.php" class="nav-login">LOGIN</a>
            <a href="<?= h(gated_link(BASE_URL . 'settings.php')) ?>" class="settings-icon" title="Settings">&#9881;</a>
        <?php endif; ?>
    </nav>
</header>

<main class="site-main">
