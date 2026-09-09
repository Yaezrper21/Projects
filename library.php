<?php
require_once __DIR__ . '/config/config.php';
require_login();

$type = ($_GET['type'] ?? 'novel') === 'manga' ? 'manga' : 'novel';

$listingTitle       = 'LIBRARY';
$genreTypeFilter    = 'library';
$showIdentityFilter = true;
$isFanfictionFilter = false;
$seriesClass        = $type;
$baseAction         = 'library.php';

require __DIR__ . '/includes/listing.php';
