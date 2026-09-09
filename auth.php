<?php
/**
 * RE-VERSE — Authentication helpers
 */

function is_logged_in(): bool
{
    return !empty($_SESSION['user_id']);
}

function is_admin(): bool
{
    return is_logged_in() && ($_SESSION['role'] ?? '') === 'admin';
}

function current_user(): ?array
{
    if (!is_logged_in()) {
        return null;
    }
    static $user = null;
    if ($user === null) {
        $stmt = get_db()->prepare('SELECT id, username, email, role, avatar_image FROM users WHERE id = ?');
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch() ?: null;
    }
    return $user;
}

/** Redirects guests to the login page, remembering where they were headed. */
function require_login(): void
{
    if (!is_logged_in()) {
        $_SESSION['redirect_after_login'] = $_SERVER['REQUEST_URI'] ?? BASE_URL;
        redirect(BASE_URL . 'login.php');
    }
}

function require_admin(): void
{
    require_login();
    if (!is_admin()) {
        http_response_code(403);
        die('Admins only.');
    }
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_check(?string $token): bool
{
    return $token !== null && !empty($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * @return string|true  Returns true on success, or an error message string.
 */
function register_user(string $username, string $email, string $password, string $verifyPassword): string|true
{
    $username = trim($username);
    $email    = trim($email);

    if ($username === '' || $email === '' || $password === '' || $verifyPassword === '') {
        return 'All fields are required.';
    }
    if (!preg_match('/^[A-Za-z0-9_]{3,30}$/', $username)) {
        return 'Username must be 3-30 characters (letters, numbers, underscore only).';
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return 'Please enter a valid email address.';
    }
    if (strlen($password) < 8) {
        return 'Password must be at least 8 characters.';
    }
    if ($password !== $verifyPassword) {
        return 'Passwords do not match.';
    }

    $db = get_db();

    $stmt = $db->prepare('SELECT id FROM users WHERE username = ? OR email = ?');
    $stmt->execute([$username, $email]);
    if ($stmt->fetch()) {
        return 'That username or email is already registered.';
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $db->prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)');
    $stmt->execute([$username, $email, $hash]);

    return true;
}

/**
 * Accepts username OR email in $identifier.
 * @return string|true
 */
function login_user(string $identifier, string $password): string|true
{
    $identifier = trim($identifier);
    if ($identifier === '' || $password === '') {
        return 'Both fields are required.';
    }

    $db = get_db();
    $stmt = $db->prepare('SELECT id, username, password_hash, role FROM users WHERE username = ? OR email = ?');
    $stmt->execute([$identifier, $identifier]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        return 'Incorrect username/email or password.';
    }

    session_regenerate_id(true);
    $_SESSION['user_id']  = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['role']     = $user['role'];

    return true;
}

function logout_user(): void
{
    $_SESSION = [];
    session_destroy();
}
