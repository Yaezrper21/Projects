<?php
require_once __DIR__ . '/config/config.php';

if (is_logged_in()) {
    redirect(BASE_URL . 'index.php');
}

$tab = ($_GET['tab'] ?? 'login') === 'register' ? 'register' : 'login';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check($_POST['csrf_token'] ?? null)) {
        $error = 'Your session expired — please try again.';
    } elseif (($_POST['action'] ?? '') === 'register') {
        $tab = 'register';
        $result = register_user(
            $_POST['username'] ?? '',
            $_POST['email'] ?? '',
            $_POST['password'] ?? '',
            $_POST['verify_password'] ?? ''
        );
        if ($result === true) {
            $loginResult = login_user($_POST['username'], $_POST['password']);
            redirect(BASE_URL . 'index.php');
        }
        $error = $result;
    } elseif (($_POST['action'] ?? '') === 'login') {
        $tab = 'login';
        $result = login_user($_POST['identifier'] ?? '', $_POST['password'] ?? '');
        if ($result === true) {
            $dest = $_SESSION['redirect_after_login'] ?? (BASE_URL . 'index.php');
            unset($_SESSION['redirect_after_login']);
            redirect($dest);
        }
        $error = $result;
    }
}

$pageTitle = ucfirst($tab);
require __DIR__ . '/includes/header.php';
?>

<div class="auth-wrap">
    <div class="auth-tabs">
        <a class="auth-tab <?= $tab === 'login' ? 'active' : '' ?>" href="?tab=login">LOGIN</a>
        <a class="auth-tab <?= $tab === 'register' ? 'active' : '' ?>" href="?tab=register">REGISTER</a>
    </div>

    <?php if ($error): ?>
        <div class="form-error"><?= h($error) ?></div>
    <?php endif; ?>

    <?php if ($tab === 'login'): ?>
        <form class="auth-form" method="post" action="login.php">
            <input type="hidden" name="action" value="login">
            <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">

            <div class="field">
                <label for="identifier">Username or Email</label>
                <input type="text" id="identifier" name="identifier" required autocomplete="username">
            </div>
            <div class="field">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required autocomplete="current-password">
            </div>

            <div class="form-actions">
                <button type="submit" class="btn">LOGIN</button>
            </div>
        </form>
    <?php else: ?>
        <form class="auth-form" method="post" action="login.php">
            <input type="hidden" name="action" value="register">
            <input type="hidden" name="csrf_token" value="<?= h(csrf_token()) ?>">

            <div class="field">
                <label for="r_username">Username</label>
                <input type="text" id="r_username" name="username" required minlength="3" maxlength="30" autocomplete="username">
            </div>
            <div class="field">
                <label for="r_email">Email</label>
                <input type="email" id="r_email" name="email" required autocomplete="email">
            </div>
            <div class="field">
                <label for="r_password">Password</label>
                <input type="password" id="r_password" name="password" required minlength="8" autocomplete="new-password">
            </div>
            <div class="field">
                <label for="r_verify">Verify Password</label>
                <input type="password" id="r_verify" name="verify_password" required minlength="8" autocomplete="new-password">
            </div>

            <div class="form-actions">
                <button type="submit" class="btn">REGISTER</button>
            </div>
        </form>
    <?php endif; ?>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
