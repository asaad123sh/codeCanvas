/** End-to-end check of the exported auth backend (registration, login, logout). */
import fs from 'node:fs';
const BASE = 'http://localhost:4177';
let cookie = '';

async function req(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    redirect: 'manual',
    headers: { ...(options.headers || {}), ...(cookie ? { Cookie: cookie } : {}) },
  });
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  setCookie.forEach((c) => {
    const [pair] = c.split(';');
    const [name] = pair.split('=');
    if (/wb_session=;|wb_session=$/.test(pair) || pair.endsWith('wb_session=')) cookie = '';
    else cookie = cookie ? `${cookie}; ${pair}` : pair;
  });
  return { status: res.status, location: res.headers.get('location'), text: await res.text(), setCookie };
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
};

// 1. Landing page must set a CSRF cookie and inline the token.
let res = await req('/');
check('page loads', res.status === 200);
check('csrf cookie issued', /wb_csrf=/.test(res.text) || cookie.includes('wb_csrf'));
const csrf = (cookie.match(/wb_csrf=([^;]+)/) || [])[1] || res.text.match(/name="_wc_csrf" value="([^"]+)"/)?.[1];
check('csrf token inline in markup', !!csrf);

// 2. Register without CSRF must be rejected.
res = await req('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ _webcraft_auth: 'register', _wc_email: 'a@b.com', _wc_pass: 'password123', _wc_csrf: 'wrong' }).toString() });
check('register without valid csrf is rejected', String(res.location).includes('auth=error'), res.location);

// 3. Register with CSRF.
res = await req('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ _webcraft_auth: 'register', _wc_name: 'Ada', _wc_email: 'ada@example.com', _wc_pass: 'password123', _wc_csrf: csrf }).toString() });
check('registration succeeds', String(res.location).includes('auth=registered'), res.location);
check('session cookie set', cookie.includes('wb_session'));

// 4. Password is hashed, never stored in clear.
const usersFile = JSON.parse(fs.readFileSync('live/data/users.json', 'utf8'));
const stored = usersFile.users[0];
check('password is hashed', stored.password && !stored.password.includes('password123'), stored.password?.slice(0, 24));
check('first account is admin', stored.role === 'admin', stored.role);

// 5. Weak password refused.
res = await req('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ _webcraft_auth: 'register', _wc_email: 'weak@example.com', _wc_pass: 'short', _wc_csrf: csrf }).toString() });
check('weak password refused', String(res.location).includes('auth=register'));

// 6. Wrong password refused, correct password works.
res = await req('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ _webcraft_auth: 'login', _wc_login: 'ada@example.com', _wc_pass: 'nope', _wc_csrf: csrf }).toString() });
check('wrong password refused', String(res.location).includes('auth=login'), res.location);

// Sign out of the session but keep the CSRF cookie, exactly like a browser.
const csrfPair = cookie.split('; ').find((c) => c.startsWith('wb_csrf='));
cookie = csrfPair || '';
res = await req('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ _webcraft_auth: 'login', _wc_login: 'ada@example.com', _wc_pass: 'password123', _wc_csrf: csrf }).toString() });
check('login succeeds', String(res.location).includes('auth=loggedin'), res.location);
check('session issued on login', cookie.includes('wb_session'));

// 7. Signed-in panel rendered server-side.
res = await req('/');
check('signed-in panel shows the user', res.text.includes('Signed in as') && res.text.includes('Ada'), res.text.match(/wb-login__who[^>]*>[^<]*/)?.[0]);
check('signed-in panel is not hidden', !res.text.includes('data-webcraft-session hidden'));

// 8. Logout.
res = await req('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ _webcraft_auth: 'logout', _wc_csrf: csrf }).toString() });
check('logout works', String(res.location).includes('auth=loggedout'), res.location);

// 9. Contact form submission, and no password ever reaches the CSV.
res = await req('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ _webcraft_form: '1', email: 'visitor@example.com', message: 'hi', password: 'leak-me' }).toString() });
check('contact form redirects to sent=1', String(res.location).includes('sent=1'), res.location);
const csv = fs.readFileSync('live/data/submissions/submissions.csv', 'utf8');
check('submission stored', csv.includes('visitor@example.com'));
check('passwords never written to the CSV', !csv.includes('leak-me'));

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${failed === 0 ? 'All auth checks passed.' : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
