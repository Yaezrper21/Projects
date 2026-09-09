<?php
/**
 * RE-VERSE — Global bootstrap
 * Included at the top of every page.
 */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

define('SITE_NAME', 'RE-VERSE');
define('BASE_URL', '/'); // change if the site lives in a subfolder, e.g. '/re-verse/'

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/auth.php';
