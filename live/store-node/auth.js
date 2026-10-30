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
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(value || '').trim());
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

/* ---- HTTP wiring (contact forms + auth) ---- */
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
        var key = decodeURIComponent((idx === -1 ? pair : pair.slice(0, idx)).replace(/\+/g, ' '));
        var value = idx === -1 ? '' : decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, ' '));
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
  var out = fresh ? keys.map(escape).join(',') + '\n' : '';
  out += keys.map(function (key) { return escape(row[key]); }).join(',') + '\n';
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
  var match = String(header || '').match(/(?:^|;\s*)wb_csrf=([^;]+)/);
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

/* ---- Search index + query ---- */
'use strict';
var fs = require('node:fs');
var path = require('node:path');
var crypto = require('node:crypto');

var MARKER = '<!--webcraft:search-results-->';
var VOID_TAGS = { area:1, base:1, br:1, col:1, embed:1, hr:1, img:1, input:1, link:1, meta:1, param:1, source:1, track:1, wbr:1 };
var SKIP_TAGS = { head:1, script:1, style:1, noscript:1, svg:1, title:1 };
var TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
var STOP_WORDS = ('a an and are as at be but by for from has have he her his i in is it its of on or our '
  + 'she that the their they this to was we were will with you your').split(' ');

/* ------------------------------------------------------------------ text */

function escapeSearchHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

/** Markup -> readable text. */
function stripTags(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9_\u00c0-\uffff]+/)
    .filter(function (term) { return term.length > 1 && STOP_WORDS.indexOf(term) === -1; });
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  var count = 0;
  var index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

/* ------------------------------------------------------------- extraction */

/** Is this opening tag a section? Sections are the unit a visitor thinks in. */
function isSectionTag(tag) {
  return tag === 'section' || tag === 'article';
}

/** Is this opening tag a WebCraft element (the builder's own markup)? */
function isWebCraftTag(attrs) {
  var classMatch = attrs.match(/\sclass="([^"]*)"/);
  return /\bwb-element\b|\bwb-widget\b|\bwb-container\b/.test(classMatch ? classMatch[1] : '');
}

function idOf(attrs) {
  var match = attrs.match(/\sid="([^"]+)"/);
  return match ? match[1] : '';
}

/**
 * Split a rendered page into its searchable blocks.
 *
 * Rules, in the order they matter to a visitor:
 *  - a <section> is always a block, and it WINS over the block it sits in, so
 *    the page's outer wrapper section does not become one giant result;
 *  - any other WebCraft element starts a block only when no block is open,
 *    so a container that holds a section is the section, not a duplicate;
 *  - everything not inside an emitted block falls back to the page document.
 *
 * A tag walker rather than a regex split, because markup nests.
 */
function splitTopLevel(html) {
  var source = String(html || '');
  var blocks = [];
  var stack = [];
  var captureStart = -1;
  var captureId = '';
  var captureDepth = 0;
  var skipUntil = null;
  var skipDepth = 0;
  var match;

  TAG_RE.lastIndex = 0;
  while ((match = TAG_RE.exec(source))) {
    var closing = match[1] === '/';
    var tag = match[2].toLowerCase();
    var attrs = match[3] || '';
    var isVoid = !!VOID_TAGS[tag];
    var isOpen = !closing && !isVoid && !/\/>$/.test(attrs);

    if (skipUntil) {
      if (isOpen && tag === skipUntil) skipDepth += 1;
      else if (closing && tag === skipUntil) {
        skipDepth -= 1;
        if (skipDepth === 0) skipUntil = null;
      }
      continue;
    }
    if (isOpen && SKIP_TAGS[tag]) { skipUntil = tag; skipDepth = 1; continue; }

    if (closing) {
      stack.pop();
      if (captureStart !== -1 && stack.length <= captureDepth) {
        blocks.push({
          id: captureId,
          start: captureStart,
          end: TAG_RE.lastIndex,
          html: source.slice(captureStart, TAG_RE.lastIndex),
        });
        captureStart = -1;
        captureId = '';
      }
      continue;
    }

    if (isOpen) {
      if (isSectionTag(tag) || (captureStart === -1 && isWebCraftTag(attrs))) {
        // A section always takes over: the wrapper it replaces keeps no block
        // of its own, its text simply falls through to the page document.
        captureStart = match.index;
        captureId = idOf(attrs);
        captureDepth = stack.length;
      }
      stack.push(tag);
    }
  }

  return blocks;
}

function firstHeading(html) {
  var match = String(html || '').match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  return match ? stripTags(match[1]) : '';
}

/**
 * Turn a rendered page into the list of documents the index searches.
 * The "url" option prefixes every result link so a multi-page site works too.
 */
function extractDocuments(html, options) {
  var opts = options || {};
  var source = String(html || '');
  var baseUrl = String(opts.url || '');
  var pageTitle = stripTags((source.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  var blocks = splitTopLevel(source);

  var documents = blocks.map(function (block, position) {
    var text = stripTags(block.html);
    var title = firstHeading(block.html) || text.slice(0, 70) || 'Section ' + (position + 1);
    var anchor = block.id ? baseUrl + '#' + block.id : baseUrl;
    return {
      id: block.id || 'section-' + (position + 1),
      url: anchor,
      title: title.slice(0, 120),
      text: text.slice(0, 20000),
      tags: [pageTitle].filter(Boolean).join(' \u00b7 '),
      order: position,
    };
  });

  // One more document for everything that is NOT inside a block (custom HTML,
  // stray links, the search box itself). Without this the page would duplicate
  // every section and pollute the results with a hit for any word on the page.
  var remainder = '';
  var cursor = 0;
  blocks.forEach(function (block) {
    remainder += source.slice(cursor, block.start);
    cursor = block.start + block.html.length;
  });
  remainder += source.slice(cursor);

  documents.unshift({
    id: 'page',
    url: baseUrl,
    title: pageTitle || 'This page',
    text: stripTags(remainder).slice(0, 20000),
    tags: '',
    order: -1,
  });

  return documents;
}

/* ----------------------------------------------------------------- search */

/**
 * Score one document against the query terms.
 * Returns null when a term is missing (AND semantics).
 */
function scoreDocument(doc, terms, phrase) {
  var title = String(doc.title || '').toLowerCase();
  var text = String(doc.text || '').toLowerCase();
  var haystack = title + ' \n ' + text;
  var total = 0;

  for (var i = 0; i < terms.length; i += 1) {
    var term = terms[i];
    var inTitle = countOccurrences(title, term);
    var inText = countOccurrences(text, term);
    if (!inTitle && !inText) return null;
    total += inTitle * 8 + inText;
    if (title.indexOf(term) === 0) total += 12;
    else if (title.indexOf(term) !== -1) total += 4;
    if (text.indexOf(' ' + term) === 0 || text.indexOf('\n' + term) !== -1) total += 1;
  }

  if (phrase.length > 1 && haystack.indexOf(phrase) !== -1) total += 10;
  return total;
}

/** A readable window of text around the first match, with <mark> highlights. */
function snippetFor(doc, terms) {
  var text = String(doc.text || '');
  var lower = text.toLowerCase();
  var at = -1;
  for (var i = 0; i < terms.length && at === -1; i += 1) at = lower.indexOf(terms[i]);

  var start = at === -1 ? 0 : Math.max(0, at - 70);
  var end = Math.min(text.length, start + 190);
  var slice = (start > 0 ? '\u2026' : '') + text.slice(start, end).trim() + (end < text.length ? '\u2026' : '');

  var html = escapeSearchHtml(slice);
  terms.forEach(function (term) {
    if (!term) return;
    html = html.replace(new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>');
  });
  // Highlighting <mark> inside escaped text is safe: no tags survived escaping.
  return html;
}

/* ------------------------------------------------------------------ index */

function createSearchIndex(options) {
  var opts = options || {};
  var dataDir = opts.dataDir || path.join(process.cwd(), 'data');
  var cacheFile = path.join(dataDir, 'search-index.json');
  var limit = opts.limit || 25;
  var cache = null;

  function readCache() {
    if (cache) return cache;
    try {
      var parsed = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (parsed && Array.isArray(parsed.documents)) { cache = parsed; return cache; }
    } catch (error) { /* no cache yet */ }
    cache = null;
    return null;
  }

  function writeCache(hash, documents) {
    cache = { hash: hash, builtAt: new Date().toISOString(), documents: documents };
    try {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
    } catch (error) { /* a read-only disk just means no cache */ }
  }

  /**
   * Index a page. Rebuilds only when the markup actually changed, so repeated
   * requests cost one hash instead of a full parse.
   */
  function build(html, meta) {
    var info = meta || {};
    var hash = crypto.createHash('sha1').update(String(html || '')).digest('hex');
    var stored = readCache();
    if (stored && stored.hash === hash) return stored.documents;

    var documents = extractDocuments(html, { url: info.url || '' });
    writeCache(hash, documents);
    return documents;
  }

  function documents() {
    var stored = readCache();
    return stored ? stored.documents : [];
  }

  function search(query, searchOptions) {
    var settings = searchOptions || {};
    var terms = tokenize(query);
    if (!terms.length) return { query: String(query || ''), terms: terms, total: 0, results: [] };

    var phrase = String(query || '').trim().toLowerCase();
    var hits = [];
    documents().forEach(function (doc) {
      var score = scoreDocument(doc, terms, phrase);
      if (score === null) return;
      hits.push({
        id: doc.id,
        url: doc.url,
        title: doc.title,
        tags: doc.tags || '',
        score: score,
        snippet: snippetFor(doc, terms),
      });
    });

    hits.sort(function (a, b) { return b.score - a.score || a.title.localeCompare(b.title); });
    var capped = hits.slice(0, settings.limit || limit);
    return { query: String(query || ''), terms: terms, total: hits.length, results: capped };
  }

  function clear() {
    cache = null;
    try { if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile); } catch (error) { /* ignore */ }
  }

  return {
    MARKER: MARKER,
    build: build,
    search: search,
    documents: documents,
    clear: clear,
    size: function () { return documents().length; }
  };
}

/* --------------------------------------------------------------- rendering */

/** The HTML that replaces <!--webcraft:search-results-->. */
function renderSearchResults(index, query, options) {
  var opts = options || {};
  var q = String(query || '').trim();
  if (!q) return '';

  var found = index.search(q, opts);
  var head = '<p class="wb-search__summary">' + (found.total === 1 ? '1 result' : found.total + ' results')
    + ' for \u201c' + escapeSearchHtml(q) + '\u201d</p>';

  if (!found.results.length) {
    return head + '<p class="wb-search__empty">Nothing matched. Try a shorter or different word.</p>';
  }

  var items = found.results.map(function (hit) {
    return '<li class="wb-search__result">'
      + '<a class="wb-search__result-title" href="' + escapeSearchHtml(hit.url) + '">' + escapeSearchHtml(hit.title) + '</a>'
      + (hit.tags ? '<span class="wb-search__result-tags">' + escapeSearchHtml(hit.tags) + '</span>' : '')
      + '<p class="wb-search__snippet">' + hit.snippet + '</p>'
      + '</li>';
  }).join('\n');

  return head + '<ol class="wb-search__results">\n' + items + '\n</ol>';
}

/** Put the query back into the search box, so results survive without JS. */
function prefillSearchInputs(html, query) {
  return html.replace(/<input\b[^>]*>/gi, function (tag) {
    if (tag.indexOf('wb-search__input') === -1) return tag;
    if (/\svalue="[^"]*"/i.test(tag)) {
      return tag.replace(/\svalue="[^"]*"/i, ' value="' + escapeSearchHtml(query) + '"');
    }
    return tag.replace(/\s*\/?>$/, function (end) {
      return ' value="' + escapeSearchHtml(query) + '"' + end;
    });
  });
}

/** Pull ?s= (or ?q=) out of a request URL. */
function searchQueryFrom(url) {
  var match = String(url || '').match(/[?&](?:s|q|search)=([^&#]*)/i);
  return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')).slice(0, 120) : '';
}

/**
 * Swap the marker in the page for real results. No marker (no search widget)
 * means the page is returned untouched; no query still clears the marker so the
 * internal comment never reaches the visitor.
 */
function renderSearch(html, index, query) {
  var source = String(html || '');
  if (source.indexOf(MARKER) === -1) return source;
  var q = String(query === undefined ? '' : query).trim();
  var body = q ? renderSearchResults(index, q) : '';
  return prefillSearchInputs(source.split(MARKER).join(body), q);
}

// Concatenated after the auth runtime in the same file, so merge, never assign.
Object.assign(module.exports, {
  SEARCH_MARKER: MARKER,
  createSearchIndex: createSearchIndex,
  extractDocuments: extractDocuments,
  renderSearch: renderSearch,
  renderSearchResults: renderSearchResults,
  searchQueryFrom: searchQueryFrom,
  prefillSearchInputs: prefillSearchInputs,
  tokenize: tokenize,
  stripTags: stripTags
});
