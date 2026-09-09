<?php
/**
 * RE-VERSE — Database connection
 * Edit the four constants below to match your MySQL setup.
 */

define('DB_HOST', 'localhost');
define('DB_NAME', 're_verse');
define('DB_USER', 'root');
define('DB_PASS', '');

function get_db(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
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
