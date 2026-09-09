<?php
require_once __DIR__ . '/config/config.php';
logout_user();
redirect(BASE_URL . 'index.php');
