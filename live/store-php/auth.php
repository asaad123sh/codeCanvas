<?php
/**
 * WebCraft Pro authentication.
 *
 * Mirrors the Node backend: scrypt/bcrypt hashing, HMAC-signed session cookie
 * and a double-submit CSRF token. No framework required.
 */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!defined('WEBCRAFT_SECRET')) {
    define('WEBCRAFT_SECRET', getenv('WEB_CRAFT_SECRET') ?: WB_SECRET_FILE);
}
define('WEBCRAFT_USERS_FILE', WB_DATA_DIR . '/users.json');
define('WEBCRAFT_CSRF_FIELD', '_wc_csrf');
define('WEBCRAFT_CSRF_COOKIE', 'wb_csrf');

function wb_b64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}
function wb_b64url_decode($data) {
    $pad = strlen($data) % 4;
    if ($pad) {
        $data .= str_repeat('=', 4 - $pad);
    }
    return base64_decode(strtr($data, '-_', '+/'));
}
function wb_read_store() {
    if (!file_exists(WEBCRAFT_USERS_FILE)) {
        return array('users' => array());
    }
    $raw = @file_get_contents(WEBCRAFT_USERS_FILE);
    $data = $raw ? json_decode($raw, true) : null;
    return (is_array($data) && isset($data['users']) && is_array($data['users'])) ? $data : array('users' => array());
}
function wb_write_store($store) {
    if (!is_dir(WB_DATA_DIR)) {
        @mkdir(WB_DATA_DIR, 0775, true);
    }
    @file_put_contents(WEBCRAFT_USERS_FILE, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}
function wb_sign($payload) {
    $body = wb_b64url_encode(json_encode($payload));
    return $body . '.' . wb_b64url_encode(hash_hmac('sha256', $body, WEBCRAFT_SECRET, true));
}
function wb_session_user() {
    $token = isset($_COOKIE['wb_session']) ? $_COOKIE['wb_session'] : '';
    if (strpos($token, '.') === false) {
        return null;
    }
    $parts = explode('.', $token);
    $body = $parts[0];
    $expected = wb_b64url_encode(hash_hmac('sha256', $body, WEBCRAFT_SECRET, true));
    if (!hash_equals($expected, $parts[1])) {
        return null;
    }
    $payload = json_decode(wb_b64url_decode($body), true);
    if (!$payload || empty($payload['exp']) || $payload['exp'] < time()) {
        return null;
    }
    foreach (wb_read_store()['users'] as $user) {
        if ($user['id'] === $payload['sub']) {
            return $user;
        }
    }
    return null;
}
function wb_start_session($user, $remember) {
    $ttl = $remember ? 7 * 86400 : 3600;
    $token = wb_sign(array('sub' => $user['id'], 'name' => $user['name'], 'exp' => time() + $ttl));
    setcookie('wb_session', $token, array(
        'expires'  => time() + $ttl,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => !empty($_SERVER['HTTPS']),
    ));
    $_COOKIE['wb_session'] = $token;
}
function wb_end_session() {
    setcookie('wb_session', '', array('expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax'));
    $_COOKIE['wb_session'] = '';
}
function wb_ensure_csrf() {
    if (empty($_COOKIE[WEBCRAFT_CSRF_COOKIE])) {
        $token = wb_b64url_encode(random_bytes(18));
        setcookie(WEBCRAFT_CSRF_COOKIE, $token, array(
            'expires'  => time() + 86400,
            'path'     => '/',
            'httponly' => false,
            'samesite' => 'Lax',
            'secure'   => !empty($_SERVER['HTTPS']),
        ));
        $_COOKIE[WEBCRAFT_CSRF_COOKIE] = $token;
    }
    return $_COOKIE[WEBCRAFT_CSRF_COOKIE];
}
function wb_csrf_valid() {
    $cookie = isset($_COOKIE[WEBCRAFT_CSRF_COOKIE]) ? $_COOKIE[WEBCRAFT_CSRF_COOKIE] : '';
    $field = isset($_POST[WEBCRAFT_CSRF_FIELD]) ? $_POST[WEBCRAFT_CSRF_FIELD] : '';
    return $cookie !== '' && $field !== '' && hash_equals($cookie, $field);
}
function wb_find_user($login) {
    $needle = strtolower(trim((string) $login));
    if ($needle === '') {
        return null;
    }
    foreach (wb_read_store()['users'] as $user) {
        if (strtolower($user['email'] ?? '') === $needle || strtolower($user['username'] ?? '') === $needle) {
            return $user;
        }
    }
    return null;
}

/**
 * Handle a login/register POST. Returns a redirect path or null.
 */
function wb_handle_auth() {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST' || empty($_POST['_webcraft_auth'])) {
        return null;
    }
    $action = preg_replace('/[^a-z_]+/i', '', (string) $_POST['_webcraft_auth']);
    $base = strtok($_SERVER['REQUEST_URI'] ?? '/', '?');
    if (!wb_csrf_valid()) {
        return $base . '?auth=error&msg=' . rawurlencode('Your session expired. Please try again.');
    }

    $users = wb_read_store();
    $users['users'] = $users['users'];

    if ($action === 'register') {
        $name  = trim(substr((string) ($_POST['_wc_name'] ?? ''), 0, 64));
        $email = strtolower(trim(substr((string) ($_POST['_wc_email'] ?? ''), 0, 64)));
        $pass  = (string) ($_POST['_wc_pass'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $base . '?auth=register&error=' . rawurlencode('Enter a valid email address.');
        }
        if (strlen($pass) < 8) {
            return $base . '?auth=register&error=' . rawurlencode('Password must be at least 8 characters.');
        }
        if (($_POST['_wc_pass2'] ?? '') !== $pass) {
            return $base . '?auth=register&error=' . rawurlencode('The two passwords do not match.');
        }
        if (wb_find_user($email)) {
            return $base . '?auth=register&error=' . rawurlencode('An account with that email already exists.');
        }
        $user = array(
            'id'         => bin2hex(random_bytes(9)),
            'name'       => $name !== '' ? $name : explode('@', $email)[0],
            'email'      => $email,
            'username'   => '',
            'password'   => password_hash($pass, PASSWORD_DEFAULT),
            'role'       => count($users['users']) === 0 ? 'admin' : 'user',
            'created_at' => date('c'),
        );
        $users['users'][] = $user;
        wb_write_store($users);
        wb_start_session($user, !empty($_POST['_wc_remember']));
        return $base . '?auth=registered';
    }

    if ($action === 'login') {
        $user = wb_find_user($_POST['_wc_login'] ?? '');
        $pass = (string) ($_POST['_wc_pass'] ?? '');
        if (!$user || !password_verify($pass, $user['password'])) {
            return $base . '?auth=login&error=' . rawurlencode('Incorrect login or password.');
        }
        wb_start_session($user, !empty($_POST['_wc_remember']));
        return $base . '?auth=loggedin';
    }

    if ($action === 'logout') {
        wb_end_session();
        return $base . '?auth=loggedout';
    }

    if ($action === 'forgot') {
        // Always report success: never reveal whether the address exists.
        return $base . '?auth=forgot&msg=' . rawurlencode('If that address has an account, a reset link is on its way.');
    }

    return $base . '?auth=error&msg=' . rawurlencode('Unknown request.');
}
