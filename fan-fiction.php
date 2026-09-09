<?php
require_once __DIR__ . '/config/config.php';
require_login();

$type = ($_GET['type'] ?? 'novel') === 'manga' ? 'manga' : 'novel';

// On the manga side this nav slot becomes "Comics" and borrows Library's
// fuller genre set + identity filter, per the site spec.
$listingTitle       = $type === 'manga' ? 'COMICS' : 'FAN-FICTION';
$genreTypeFilter    = $type === 'manga' ? 'library' : 'fandom';
$showIdentityFilter = $type === 'manga';
$isFanfictionFilter = true;
$seriesClass        = $type;
$baseAction         = 'fan-fiction.php';

require __DIR__ . '/includes/listing.php';
