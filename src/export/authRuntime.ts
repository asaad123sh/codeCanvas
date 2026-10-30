/**
 * Shared backend core for the generated sites.
 *
 * This is ONE implementation used by both the Node/Express export and the
 * local "Test Live Website" server, so the two can never drift apart. It is
 * plain CommonJS in a string (like the widget runtime) because it has to be
 * written to disk inside an exported project and loaded by a bare `node`
 * process with **no npm install** — only `node:crypto` is used.
 *
 * Security model
 *  - passwords: scrypt (N=16384) with a per-user random salt, constant-time compare
 *  - sessions:  HMAC-SHA256 signed cookie, no server session table needed
 *  - CSRF:     double-submit cookie (`wb_csrf` cookie must match the `_wc_csrf` field)
 *  - the file store is only a convenience for zero-setup hosting: every read is
 *    re-validated and nothing is trusted from the client except the credentials.
 */

export const AUTH_BACKEND = `
'use strict';
var crypto = require('node:crypto');
var fs = require('node:fs');
var path = require('node:path');

var SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
var COOKIE_SESSION = 'wb_session';
var COOKIE_CSRF = 'wb_csrf';
var SESSION_DAYS = 7;

/* ---------------------------------------------------------------- utils */

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
  var pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}
function timingSafeEqual(a, b) {
  var bufA = Buffer.from(String(a));
  var bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
function parseCookies(header) {
  var out = {};
  String(header || '').split(';').forEach(function (part) {
    var idx = part.indexOf('=');
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}
function isEmail(value) {
  return /^[^\\s@]+@[^\\s@]+\\.[a-z]{2,}$/i.test(String(value || '').trim());
}
function cleanName(value) {
  return String(value || '').trim().slice(0, 64);
}

/* ------------------------------------------------------------- passwords */

function hashPassword(password, salt) {
  var useSalt = salt || crypto.randomBytes(16).toString('hex');
  var hash = crypto
    .scryptSync(String(password), useSalt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p })
    .toString('hex');
  return useSalt + '$' + hash;
}

function verifyPassword(password, stored) {
  var parts = String(stored || '').split('$');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  var hash = crypto
    .scryptSync(String(password), parts[0], SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p })
    .toString('hex');
  return timingSafeEqual(hash, parts[1]);
}

/* -------------------------------------------------------------- sessions */

function signPayload(payload, secret) {
  return b64url(Buffer.from(JSON.stringify(payload))) + '.' + b64url(crypto.createHmac('sha256', secret).update(b64url(Buffer.from(JSON.stringify(payload)))).digest());
}
function readSession(token, secret) {
  if (!token || token.indexOf('.') === -1) return null;
  var idx = token.lastIndexOf('.');
  var body = token.slice(0, idx);
  var signature = token.slice(idx + 1);
  var expected = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  if (!timingSafeEqual(signature, expected)) return null;
  try {
    var payload = JSON.parse(fromB64url(body).toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (error) {
    return null;
  }
}

function cookie(name, value, options) {
  var opts = options || {};
  var parts = [name + '=' + encodeURIComponent(value), 'Path=' + (opts.path || '/')];
  if (opts.maxAge) parts.push('Max-Age=' + opts.maxAge);
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  parts.push('SameSite=Lax');
  if (opts.secure) parts.push('Secure');
  return parts.join('; ');
}

/* ------------------------------------------------------------- the core */

function createBackend(options) {
  var opts = options || {};
  var dataDir = opts.dataDir || path.join(process.cwd(), 'data');
  var usersFile = path.join(dataDir, 'users.json');
  var secretFile = path.join(dataDir, 'secret.key');
  var secret = opts.secret || process.env.WEB_CRAFT_SECRET || '';
  var maxUsers = opts.maxUsers || 1000;

  function ensureDirs() {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!secret) {
      if (fs.existsSync(secretFile)) {
        secret = fs.readFileSync(secretFile, 'utf8').trim();
      } else {
        secret = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(secretFile, secret, { mode: 0o600 });
      }
    }
  }

  function readStore() {
    ensureDirs();
    try {
      var parsed = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      if (parsed && Array.isArray(parsed.users)) return parsed;
    } catch (error) {
      /* corrupt or missing — start clean rather than crash the site */
    }
    return { users: [] };
  }

  function writeStore(store) {
    ensureDirs();
    fs.writeFileSync(usersFile, JSON.stringify(store, null, 2), { mode: 0o600 });
  }

  function publicUser(user) {
    return { id: user.id, name: user.name, email: user.email, role: user.role || 'user', createdAt: user.created_at };
  }

  function findByLogin(login) {
    var needle = String(login || '').trim().toLowerCase();
    if (!needle) return null;
    return readStore().users.filter(function (u) {
      return String(u.email || '').toLowerCase() === needle || String(u.username || '').toLowerCase() === needle;
    })[0] || null;
  }

  function register(input) {
    var name = cleanName(input.name);
    var email = cleanName(input.email).toLowerCase();
    var username = cleanName(input.username).toLowerCase();
    var password = String(input.password || '');

    if (!email && !username) return { ok: false, error: 'Enter an email address or username.' };
    if (email && !isEmail(email)) return { ok: false, error: 'That email address does not look valid.' };
    if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };
    if (findByLogin(email || username)) return { ok: false, error: 'An account with those details already exists.' };

    var store = readStore();
    if (store.users.length >= maxUsers) return { ok: false, error: 'Registration is closed.' };

    var user = {
      id: b64url(crypto.randomBytes(9)),
      name: name || (email ? email.split('@')[0] : username),
      email: email,
      username: username,
      password: hashPassword(password),
      role: store.users.length === 0 ? 'admin' : 'user',
      created_at: new Date().toISOString()
    };
    store.users.push(user);
    writeStore(store);
    return { ok: true, user: publicUser(user) };
  }

  function authenticate(input) {
    var user = findByLogin(input.login);
    // Always run a hash comparison so a missing user and a wrong password take
    // the same time (no account enumeration through timing).
    if (!user) {
      hashPassword(String(input.password || ''), 'decoy-salt-for-constant-time');
      return { ok: false, error: 'Incorrect login or password.' };
    }
    if (!verifyPassword(input.password, user.password)) {
      return { ok: false, error: 'Incorrect login or password.' };
    }
    return { ok: true, user: publicUser(user) };
  }

  function currentUser(cookies) {
    var session = readSession(cookies[COOKIE_SESSION], secret);
    if (!session) return null;
    var user = readStore().users.filter(function (u) { return u.id === session.sub; })[0];
    return user ? publicUser(user) : null;
  }

  function sessionCookie(user, remember) {
    var maxAge = remember ? SESSION_DAYS * 86400 : null;
    return cookie(COOKIE_SESSION, signPayload({ sub: user.id, name: user.name, exp: Date.now() + (maxAge || 3600000) }, secret), { maxAge: maxAge, httpOnly: true });
  }
  function clearSessionCookie() {
    return cookie(COOKIE_SESSION, '', { maxAge: 0 });
  }
  function csrfCookie() {
    return cookie(COOKIE_CSRF, b64url(crypto.randomBytes(18)), { httpOnly: false, maxAge: 86400 });
  }

  function isNewInstall() {
    return readStore().users.length === 0;
  }

  function countUsers() {
    return readStore().users.length;
  }

  return {
    COOKIE_SESSION: COOKIE_SESSION,
    COOKIE_CSRF: COOKIE_CSRF,
    bootstrap: ensureDirs,
    isNewInstall: isNewInstall,
    countUsers: countUsers,
    register: register,
    authenticate: authenticate,
    currentUser: currentUser,
    sessionCookie: sessionCookie,
    clearSessionCookie: clearSessionCookie,
    csrfCookie: csrfCookie,
    hashPassword: hashPassword,
    verifyPassword: verifyPassword
  };
}

module.exports = { createBackend: createBackend, parseCookies: parseCookies, isEmail: isEmail, hashPassword: hashPassword, verifyPassword: verifyPassword };
`.trim();

/**
 * HTTP wiring for both POST entry points (contact forms + auth).
 *
 * Also one implementation: the Express export and the local live-preview
 * server both mount this, so the site behaves identically when you click
 * "Test Live Website" and when you deploy the exported project.
 *
 * Returns true when it handled the request, false when the caller should keep
 * serving the page / static files.
 */
export const HTTP_HANDLER = `
'use strict';
var fs = require('node:fs');
var path = require('node:path');

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    var chunks = [];
    req.on('data', function (chunk) { chunks.push(chunk); });
    req.on('end', function () {
      var raw = Buffer.concat(chunks).toString('utf8');
      var out = {};
      raw.split('&').forEach(function (pair) {
        if (!pair) return;
        var idx = pair.indexOf('=');
        var key = decodeURIComponent((idx === -1 ? pair : pair.slice(0, idx)).replace(/\\+/g, ' '));
        var value = idx === -1 ? '' : decodeURIComponent(pair.slice(idx + 1).replace(/\\+/g, ' '));
        if (Object.prototype.hasOwnProperty.call(out, key)) {
          out[key] = [].concat(out[key], value);
        } else {
          out[key] = value;
        }
      });
      resolve(out);
    });
    req.on('error', function () { resolve({}); });
  });
}

function flatten(value) {
  return Array.isArray(value) ? value.join(', ') : String(value == null ? '' : value);
}

function appendSubmission(dataDir, body) {
  var dir = path.join(dataDir, 'submissions');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  var file = path.join(dir, 'submissions.csv');
  var fresh = !fs.existsSync(file);
  var row = { submitted_at: new Date().toISOString() };
  Object.keys(body).forEach(function (key) {
    if (key.charAt(0) === '_') return;                 // internal markers
    if (/pass|password|token|secret|csrf/i.test(key)) return;  // never store secrets
    row[key.replace(/[^a-z0-9_]+/gi, '_')] = flatten(body[key]).slice(0, 5000);
  });
  var keys = Object.keys(row);
  var escape = function (value) { return '"' + String(value).replace(/"/g, '""') + '"'; };
  var out = fresh ? keys.map(escape).join(',') + '\\n' : '';
  out += keys.map(function (key) { return escape(row[key]); }).join(',') + '\\n';
  fs.appendFileSync(file, out);
  return file;
}

function redirect(res, location, headers) {
  res.writeHead(302, Object.assign({ Location: location }, headers || {}));
  res.end();
}

/**
 * @param backend  result of createBackend()
 * @param options  { dataDir, staticDir, serveFile(relPath) }
 */
function createPostHandler(backend, options) {
  var opts = options || {};
  var dataDir = opts.dataDir || path.join(process.cwd(), 'data');
  var redirectPath = function (url) { return String(url || '/').split('?')[0]; };

  return async function handle(req, res) {
    if (req.method !== 'POST') return false;
    var body = await readBody(req);
    if (!body || typeof body !== 'object') return false;

    var headers = {};
    // Make sure the visitor always carries a CSRF cookie (double submit).
    if (!req.headers || !req.headers.cookie || req.headers.cookie.indexOf(backend.COOKIE_CSRF) === -1) {
      headers['Set-Cookie'] = backend.csrfCookie();
    }

    if (body._webcraft_auth) {
      var action = String(body._webcraft_auth).replace(/[^a-z_]/gi, '');
      var target = redirectPath(req.url);
      var csrfCookie = parseCsrf(req.headers && req.headers.cookie);
      if (!csrfCookie || csrfCookie !== flatten(body._wc_csrf)) {
        redirect(res, target + '?auth=error&msg=' + encodeURIComponent('Your session expired. Please try again.'), headers);
        return true;
      }
      if (action === 'register') {
        var result = backend.register({ name: body._wc_name, email: body._wc_email, password: body._wc_pass });
        if (!result.ok) {
          redirect(res, target + '?auth=register&error=' + encodeURIComponent(result.error), headers);
          return true;
        }
        headers['Set-Cookie'] = [headers['Set-Cookie'], backend.sessionCookie(result.user, !!body._wc_remember)].filter(Boolean).join('; ');
        redirect(res, target + '?auth=registered', headers);
        return true;
      }
      if (action === 'login') {
        var auth = backend.authenticate({ login: body._wc_login, password: body._wc_pass });
        if (!auth.ok) {
          redirect(res, target + '?auth=login&error=' + encodeURIComponent(auth.error), headers);
          return true;
        }
        headers['Set-Cookie'] = [headers['Set-Cookie'], backend.sessionCookie(auth.user, !!body._wc_remember)].filter(Boolean).join('; ');
        redirect(res, target + '?auth=loggedin', headers);
        return true;
      }
      if (action === 'logout') {
        headers['Set-Cookie'] = [headers['Set-Cookie'], backend.clearSessionCookie()].filter(Boolean).join('; ');
        redirect(res, target + '?auth=loggedout', headers);
        return true;
      }
      if (action === 'forgot') {
        // Never reveal whether the address exists.
        redirect(res, target + '?auth=forgot&msg=' + encodeURIComponent('If that address has an account, a reset link is on its way.'), headers);
        return true;
      }
      redirect(res, target + '?auth=error&msg=' + encodeURIComponent('Unknown request.'), headers);
      return true;
    }

    if (body._webcraft_form) {
      try {
        appendSubmission(dataDir, body);
      } catch (error) {
        console.error('Could not store submission:', error.message);
      }
      redirect(res, redirectPath(req.url) + '?sent=1', headers);
      return true;
    }

    return false;
  };
}

function parseCsrf(header) {
  var match = String(header || '').match(/(?:^|;\\s*)wb_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function cookiesOf(req) {
  var header = (req && req.headers && req.headers.cookie) || '';
  var out = {};
  header.split(';').forEach(function (part) {
    var idx = part.indexOf('=');
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

/** The CSRF token this request should embed in forms. */
function csrfToken(backend, req) {
  return cookiesOf(req)[backend.COOKIE_CSRF] || '';
}

/**
 * Fill the two server-side placeholders in the generated page:
 *   <!--webcraft:session-->  -> signed-in panel (or nothing)
 *   __WEBCRAFT_CSRF__        -> the double-submit token
 * Returns { html, headers } so the caller can set the CSRF cookie on first load.
 */
function renderIndex(html, backend, req) {
  var cookies = cookiesOf(req);
  var user = backend.currentUser(cookies);
  var csrf = cookies[backend.COOKIE_CSRF];
  var headers = {};

  if (!csrf) {
    csrf = backend.csrfCookie();
    headers['Set-Cookie'] = csrf;
    // Reuse the value we just generated for the inline token.
    csrf = String(csrf).match(/wb_csrf=([^;]+)/)[1];
    csrf = decodeURIComponent(csrf);
  }

  var sessionBlock = user
    ? '<p class="wb-login__who">Signed in as <strong>' + escapeHtml(user.name) + '</strong></p>' +
      '<form method="post" class="wb-login__logout">' +
      '<input type="hidden" name="_webcraft_auth" value="logout">' +
      '<input type="hidden" name="_wc_csrf" value="' + escapeHtml(csrf) + '">' +
      '<button type="submit" class="wb-login__submit">Sign out</button></form>'
    : '<p class="wb-login__who">You are not signed in.</p>';

  return {
    headers: headers,
    html: html
      .replace(/<!--webcraft:session-->/g, sessionBlock)
      .replace(/__WEBCRAFT_CSRF__/g, escapeHtml(csrf))
      .replace(/ data-webcraft-session>/g, user ? ' data-webcraft-session>' : ' data-webcraft-session hidden>'),
  };
}

// Merge into the existing exports: this file is concatenated AFTER the backend
// core, so a plain assignment here would wipe out createBackend().
Object.assign(module.exports, {
  createPostHandler: createPostHandler,
  appendSubmission: appendSubmission,
  renderIndex: renderIndex,
  csrfToken: csrfToken,
  cookiesOf: cookiesOf,
  escapeHtml: escapeHtml
});
`.trim();

/** PHP twin of the core above — same rules, native password_hash(). */
export const PHP_AUTH = `<?php
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
`.trim();
