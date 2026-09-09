<?php
/**
 * RE-VERSE — Database connection (Supabase / PostgreSQL)
 *
 * Find these in Supabase: Project Settings → Database → Connection string
 * (choose "Session pooler" for most shared PHP hosts, or "Direct
 * connection" if your host allows long-lived outbound connections).
 * These are NOT the anon/service_role API keys — those are for
 * Supabase's REST layer, which this app doesn't use.
 *
 * Requires the pdo_pgsql PHP extension. Most modern hosts have it, but
 * it isn't as universally pre-enabled as pdo_mysql — if get_db() dies
 * with a connection error, check `php -m | grep pgsql` first.
 */

define('DB_HOST', 'db.xxxxxxxxxxxxxxxx.supabase.co'); // Settings → Database → Host
define('DB_PORT', '5432');                             // 5432 direct/session pooler, 6543 transaction pooler
define('DB_NAME', 'postgres');
define('DB_USER', 'postgres');
define('DB_PASS', 'your-database-password');

function get_db(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        $dsn = 'pgsql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';sslmode=require';
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            // Never leak credentials or raw exception details to the browser.
            error_log('DB connection failed: ' . $e->getMessage());
            die('Something went wrong connecting to the database. Please try again later.');
        }
    }

    return $pdo;
}
