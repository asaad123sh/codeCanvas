/* WebCraft Pro widget runtime */
(function () {
  'use strict';

  function each(selector, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), fn);
  }

  /* Tabs ---------------------------------------------------------- */
  each('.wb-tabs', function (root) {
    var buttons = root.querySelectorAll('.wb-tabs__tab');
    var panels = root.querySelectorAll('.wb-tabs__panel');
    Array.prototype.forEach.call(buttons, function (btn, index) {
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(buttons, function (b) { b.classList.remove('is-active'); });
        Array.prototype.forEach.call(panels, function (p) { p.classList.remove('is-active'); });
        btn.classList.add('is-active');
        if (panels[index]) panels[index].classList.add('is-active');
      });
    });
  });

  /* Accordion ----------------------------------------------------- */
  each('.wb-accordion', function (root) {
    Array.prototype.forEach.call(root.querySelectorAll('.wb-accordion__header'), function (header) {
      header.addEventListener('click', function () {
        header.parentElement.classList.toggle('is-open');
      });
    });
  });

  /* Carousel ------------------------------------------------------ */
  each('.wb-carousel__track', function (track) {
    var prev = track.parentElement.querySelector('.wb-carousel__btn--prev');
    var next = track.parentElement.querySelector('.wb-carousel__btn--next');
    function step(dir) {
      var slide = track.firstElementChild;
      var width = slide ? slide.getBoundingClientRect().width + 16 : track.clientWidth;
      track.scrollBy({ left: dir * width, behavior: 'smooth' });
    }
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });
  });

  /* Countdown ----------------------------------------------------- */
  each('.wb-countdown[data-due-date]', function (root) {
    var due = new Date(root.getAttribute('data-due-date')).getTime();
    if (isNaN(due)) return;
    var fields = {
      days: root.querySelector('[data-unit="days"]'),
      hours: root.querySelector('[data-unit="hours"]'),
      minutes: root.querySelector('[data-unit="minutes"]'),
      seconds: root.querySelector('[data-unit="seconds"]')
    };
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function tick() {
      var diff = Math.max(0, due - Date.now());
      var total = Math.floor(diff / 1000);
      var days = Math.floor(total / 86400);
      var hours = Math.floor((total % 86400) / 3600);
      var minutes = Math.floor((total % 3600) / 60);
      var seconds = total % 60;
      if (fields.days) fields.days.textContent = pad(days);
      if (fields.hours) fields.hours.textContent = pad(hours);
      if (fields.minutes) fields.minutes.textContent = pad(minutes);
      if (fields.seconds) fields.seconds.textContent = pad(seconds);
      if (diff > 0) setTimeout(tick, 1000);
    }
    tick();
  });

  /* Counter ------------------------------------------------------- */
  each('.wb-counter', function (root) {
    var target = parseFloat(String(root.textContent).replace(/[^0-9.-]/g, ''));
    if (!isFinite(target) || target === 0) return;
    var raw = String(root.textContent);
    var suffix = raw.replace(/[0-9.,\s]/g, '');
    var started = false;
    function run() {
      if (started) return;
      started = true;
      var start = performance.now();
      var duration = 1600;
      function frame(now) {
        var t = Math.min(1, (now - start) / duration);
        var eased = 1 - Math.pow(1 - t, 3);
        var value = target * eased;
        var decimals = (raw.split('.')[1] || '').length;
        root.textContent = (decimals ? value.toFixed(decimals) : Math.round(value).toLocaleString()) + suffix;
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { if (entry.isIntersecting) { run(); observer.disconnect(); } });
      }, { threshold: 0.4 });
      observer.observe(root);
    } else {
      run();
    }
  });

  /* Animated headline --------------------------------------------- */
  each('.wb-animated-headline[data-animation="typing"] .wb-animated-headline__static', function (root) {
    var text = root.textContent;
    var i = 0;
    var deleting = false;
    function tick() {
      root.textContent = text.slice(0, i);
      if (!deleting && i < text.length) { i++; setTimeout(tick, 90); }
      else if (!deleting) { deleting = true; setTimeout(tick, 1400); }
      else if (i > 0) { i--; setTimeout(tick, 45); }
      else { deleting = false; setTimeout(tick, 500); }
    }
    tick();
  });

  each('.wb-animated-headline__rotating[data-words]', function (root) {
    var words = root.getAttribute('data-words').split('|').map(function (w) { return w.trim(); }).filter(Boolean);
    if (!words.length) return;
    var index = 0;
    root.textContent = words[0];
    setInterval(function () {
      index = (index + 1) % words.length;
      root.textContent = words[index];
    }, 2200);
  });

  /* Authentication widget ---------------------------------------- */
  function readCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
  }

  function showNotice(container, text, kind) {
    if (!container) return false;
    container.textContent = text;
    container.className = 'wb-login__notice' + (kind ? ' ' + kind : '');
    return true;
  }

  /* A page without an auth widget still needs to confirm a contact form. */
  function globalToast(text, kind) {
    var toast = document.createElement('div');
    toast.className = 'wb-login__notice ' + kind;
    toast.setAttribute('role', 'status');
    toast.textContent = text;
    toast.style.cssText =
      'position:fixed;left:50%;top:20px;transform:translateX(-50%);z-index:9999;' +
      'padding:10px 18px;font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,.25)';
    document.body.appendChild(toast);
    window.setTimeout(function () { toast.remove(); }, 6000);
  }

  var params = new URLSearchParams(window.location.search);
  if (params.has('sent')) {
    if (!showNotice(document.querySelector('[data-auth-notice]'), 'Thanks! Your message has been sent.', 'is-success')) {
      globalToast('Thanks! Your message has been sent.', 'is-success');
    }
  }

  /* Prefill the search box from ?s= (or ?q=) so a results page still shows
     what was searched for, exactly like WordPress. */
  each('.wb-search__input', function (input) {
    var name = input.getAttribute('name') || 's';
    var value = params.get(name) || params.get('s') || params.get('q') || '';
    if (value && !input.value) input.value = value;
  });

  /* Clicking a result should not leave the visitor stranded: if the target
     element is not on this page, go back to the top instead of doing nothing. */
  each('.wb-search__results a[href^="#"]', function (link) {
    link.addEventListener('click', function () {
      var target = document.getElementById(decodeURIComponent(link.getAttribute('href').slice(1)));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  each('.wb-login-form', function (form) {
    var modeInput = form.querySelector('[data-auth-mode-value]');
    var csrfInput = form.querySelector('[data-webcraft-csrf]');
    var notice = form.querySelector('[data-auth-notice]');
    var panels = form.querySelectorAll('[data-auth-panel]');

    // Double-submit CSRF: mirror the cookie the server set. Servers that render
    // the page (PHP/WordPress/Node) inline the token instead — keep it if set.
    if (csrfInput && !csrfInput.value) {
      csrfInput.value = readCookie('wb_csrf');
    }

    function setMode(mode) {
      if (modeInput) modeInput.value = mode;
      Array.prototype.forEach.call(panels, function (panel) {
        panel.hidden = panel.getAttribute('data-auth-panel') !== mode;
      });
      if (notice) { notice.textContent = ''; notice.className = 'wb-login__notice'; }
    }

    Array.prototype.forEach.call(form.querySelectorAll('[data-auth-switch]'), function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        setMode(button.getAttribute('data-auth-switch'));
      });
    });

    // Client-side checks for the register panel (the server re-validates all).
    form.addEventListener('submit', function (event) {
      var mode = modeInput ? modeInput.value : 'login';
      var email = form.querySelector('[data-auth-panel="register"] [name="_wc_email"]');
      if (mode === 'register') {
        var pass = form.querySelector('[name="_wc_pass"]');
        var pass2 = form.querySelector('[name="_wc_pass2"]');
        if (pass && pass2 && pass.value !== pass2.value) {
          event.preventDefault();
          if (notice) {
            notice.textContent = 'The two passwords do not match.';
            notice.className = 'wb-login__notice is-error';
          }
          return;
        }
        if (pass && pass.value.length < 8) {
          event.preventDefault();
          if (notice) {
            notice.textContent = 'Password must be at least 8 characters.';
            notice.className = 'wb-login__notice is-error';
          }
          return;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.value)) {
          event.preventDefault();
          if (notice) {
            notice.textContent = 'Enter a valid email address.';
            notice.className = 'wb-login__notice is-error';
          }
          return;
        }
      }
      if (mode === 'forgot' && email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.value)) {
        event.preventDefault();
        if (notice) {
          notice.textContent = 'Enter a valid email address.';
          notice.className = 'wb-login__notice is-error';
        }
        return;
      }
      // Contact forms can post without JavaScript; auth needs the CSRF token.
      if (csrfInput && !csrfInput.value) {
        event.preventDefault();
        if (notice) {
          notice.textContent = 'Your session expired — reload the page and try again.';
          notice.className = 'wb-login__notice is-error';
        }
      }
    });

    if (params.has('auth')) {
      var state = params.get('auth');
      var messages = {
        loggedin: ['You are signed in.', 'is-success'],
        loggedout: ['You have been signed out.', 'is-success'],
        registered: ['Your account is ready — you are signed in.', 'is-success'],
        forgot: [params.get('msg') || 'If that address has an account, a reset link is on its way.', 'is-success'],
        error: [params.get('msg') || 'Something went wrong. Please try again.', 'is-error']
      };
      var message = messages[state];
      if (message && showNotice(notice, message[0], message[1])) {
        if (state === 'register' || state === 'login' || state === 'forgot') setMode(state);
      }
    }
  });

  if (params.has('sent') || params.has('auth') || params.has('msg') || params.has('error')) {
    ['sent', 'auth', 'msg', 'error'].forEach(function (key) { params.delete(key); });
    if (window.history && window.history.replaceState) {
      var query = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
    }
  }
})();(function () {
  'use strict';

  var SEED = window.__WB_SHOP__ || {};
  var PRODUCTS = SEED.products || [];
  var CATEGORIES = SEED.categories || [];
  var SELLERS = SEED.sellers || [];
  var COUPONS = SEED.coupons || [];
  var SHIPPING = SEED.shipping || [];
  var PAYMENTS = SEED.payments || [];
  var SETTINGS = SEED.settings || {};
  var STATUSES = SEED.statuses || [];
  var STATUS_LABEL = {};
  STATUSES.forEach(function (s) { STATUS_LABEL[s.id] = s.label; });
  var STATUS_ORDER = STATUSES.map(function (s) { return s.id; });
  var COD_STATUSES = SEED.codStatuses || [];
  var PRODUCT_PATH = SEED.productPath || 'product.html';
  var API = SEED.api || '/api/shop';

  var K = {
    cart: 'wb_cart_v1',
    wish: 'wb_wish_v1',
    coupon: 'wb_coupon_v1',
    ship: 'wb_ship_v1',
    filters: 'wb_filters_v1'
  };

  /* ------------------------------------------------------------ state */

  var listeners = [];
  function on(fn) { listeners.push(fn); }
  function emit() { updateBadges(); listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  function read(key, fallback) {
    try { var raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function cart() {
    var items = read(K.cart, []);
    return (items || []).filter(function (i) { return i && i.sku && i.qty > 0; });
  }
  function setCart(items) { write(K.cart, items || []); emit(); }
  function addToCart(sku, qty) {
    var items = cart(), found = null;
    for (var i = 0; i < items.length; i++) if (items[i].sku === sku) found = items[i];
    if (found) found.qty = Math.min(99, found.qty + (qty || 1));
    else items.push({ sku: sku, qty: Math.min(99, qty || 1) });
    setCart(items);
    toast(productBySku(sku) ? 'Added ' + productBySku(sku).name : 'Added to cart');
  }
  function setQty(sku, qty) {
    var items = cart();
    items = items.map(function (i) { return i.sku === sku ? { sku: sku, qty: qty } : i; })
      .filter(function (i) { return i.qty > 0; });
    setCart(items);
  }
  function removeFromCart(sku) { setCart(cart().filter(function (i) { return i.sku !== sku; })); }
  function wishlist() { return read(K.wish, []) || []; }
  function toggleWish(sku) {
    var list = wishlist(), i = list.indexOf(sku);
    if (i === -1) list.push(sku); else list.splice(i, 1);
    write(K.wish, list); emit();
  }
  function couponCode() { return read(K.coupon, '') || ''; }
  function setCoupon(code) { write(K.coupon, code || ''); emit(); }
  function shippingMethod() { return read(K.ship, '') || 'standard'; }
  function setShippingMethod(id) { write(K.ship, id || 'standard'); emit(); }
  function filters() {
    var f = read(K.filters, {});
    return { cat: f.cat || '', q: f.q || '', sort: f.sort || 'featured', min: f.min || '', max: f.max || '' };
  }
  function setFilters(next) { write(K.filters, Object.assign(filters(), next)); emit(); }

  /* ---------------------------------------------------------- helpers */

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function frag(html) {
    var t = document.createElement('template');
    t.innerHTML = String(html || '').trim();
    return t.content;
  }
  function money(n) {
    var v = Math.round((Number(n) || 0) * 100) / 100;
    var parts = v.toFixed(2).split('.');
    return (SETTINGS.currency || '$') + parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + parts[1];
  }
  function qp(name) {
    var out = {};
    (String(window.location.search || '').charAt(0) === '?' ? window.location.search.slice(1) : '')
      .split('&').forEach(function (pair) {
        if (!pair) return;
        var idx = pair.indexOf('=');
        var key = decodeURIComponent((idx === -1 ? pair : pair.slice(0, idx)).replace(/\+/g, ' '));
        out[key] = idx === -1 ? '' : decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, ' '));
      });
    return out[name];
  }
  function productBySku(sku) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].sku === sku) return PRODUCTS[i];
    return null;
  }
  function productBySlug(slug) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].slug === slug) return PRODUCTS[i];
    return null;
  }
  function sellerById(id) {
    for (var i = 0; i < SELLERS.length; i++) if (SELLERS[i].id === id) return SELLERS[i];
    return null;
  }
  function categoryBySlug(slug) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].slug === slug) return CATEGORIES[i];
    return null;
  }
  function productUrl(p) { return PRODUCT_PATH + '?product=' + encodeURIComponent(p.slug); }
  function stars(rating) {
    var full = Math.round(Number(rating) || 0);
    var out = '';
    for (var i = 1; i <= 5; i++) out += i <= full ? '\u2605' : '\u2606';
    return '<span class="wb-stars" title="' + esc(rating) + ' out of 5">' + out + '</span>';
  }
  function toast(message) {
    var node = document.createElement('div');
    node.className = 'wb-toast';
    node.textContent = message;
    document.body.appendChild(node);
    window.setTimeout(function () { node.remove(); }, 2400);
  }
  function params(node) {
    var out = {};
    if (!node) return out;
    Array.prototype.forEach.call(node.attributes || [], function (a) {
      if (a.name.indexOf('data-') === 0 && a.name.length > 5) {
        out[a.name.slice(5)] = a.value;
      }
    });
    return out;
  }
  function updateBadges() {
    var count = cart().reduce(function (a, i) { return a + i.qty; }, 0);
    Array.prototype.forEach.call(document.querySelectorAll('[data-wb-cart-count]'), function (el) {
      el.textContent = String(count);
      el.style.display = count ? '' : 'none';
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-wb-wish-count]'), function (el) {
      var n = wishlist().length;
      el.textContent = String(n);
      el.style.display = n ? '' : 'none';
    });
  }

  /* ---------------------------------------------------------- pricing */

  function couponFor(code, subtotal) {
    var found = null;
    COUPONS.forEach(function (c) {
      if (String(c.code).toUpperCase() === String(code || '').toUpperCase()) found = c;
    });
    if (!found) return null;
    if (found.min && subtotal < found.min) return { coupon: found, usable: false };
    return { coupon: found, usable: true };
  }

  /**
   * One pricing engine for the preview, the Node store and the PHP store:
   * subtotal -> coupon -> shipping -> COD fee -> tax -> total.
   */
  function totals(items, opts) {
    opts = opts || {};
    var lines = [], subtotal = 0;
    (items || []).forEach(function (line) {
      var p = productBySku(line.sku);
      if (!p) return;
      var lineTotal = round2(p.price * line.qty);
      subtotal = round2(subtotal + lineTotal);
      lines.push({ product: p, qty: line.qty, total: lineTotal });
    });

    var resolved = couponFor(opts.coupon !== undefined ? opts.coupon : couponCode(), subtotal);
    var coupon = resolved ? resolved.coupon : null;
    var usable = resolved ? resolved.usable : false;
    var discount = 0, freeShip = false;
    if (usable && coupon) {
      if (coupon.type === 'percent') discount = round2(subtotal * coupon.value / 100);
      else if (coupon.type === 'fixed') discount = coupon.value;
      else if (coupon.type === 'shipping') freeShip = true;
      discount = Math.min(discount, subtotal);
    }

    var shipId = opts.shipping || shippingMethod();
    var shipRow = null;
    SHIPPING.forEach(function (s) { if (s.id === shipId) shipRow = s; });
    if (!shipRow) shipRow = SHIPPING[0] || { id: 'standard', label: 'Standard', fee: 0, days: '' };

    var shipping = 0;
    if (subtotal > 0 && shipRow) {
      var qualifies = freeShip || (SETTINGS.freeShippingOver && shipRow.id === 'standard'
        && subtotal >= SETTINGS.freeShippingOver);
      shipping = qualifies ? 0 : shipRow.fee;
    }

    var payment = opts.payment || 'cod';
    var codFee = (payment === 'cod' && SETTINGS.codEnabled !== false && SETTINGS.codFee && subtotal > 0)
      ? SETTINGS.codFee : 0;
    var discounted = Math.max(0, round2(subtotal - discount));
    var tax = round2(discounted * (Number(SETTINGS.taxRate) || 0) / 100);
    var total = round2(discounted + shipping + codFee + tax);

    return {
      lines: lines, subtotal: subtotal, discount: discount, coupon: coupon, couponUsable: usable,
      shipping: shipping, shippingRow: shipRow, codFee: codFee, tax: tax, total: total,
      count: lines.reduce(function (a, l) { return a + l.qty; }, 0)
    };
  }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  /* -------------------------------------------------------- card html */

  function stockLine(p) {
    if (!p.active) return '<span class="wb-product__stock is-out">Unavailable</span>';
    if (p.stock <= 0) return '<span class="wb-product__stock is-out">Out of stock</span>';
    var cls = p.stock <= (SETTINGS.lowStockAt || 10) ? ' is-low' : '';
    return '<span class="wb-product__stock' + cls + '">In stock (' + p.stock + ' left)</span>';
  }
  function badgeClass(badge) {
    if (!badge) return '';
    if (badge === 'Sale') return ' is-sale';
    if (badge === 'New') return ' is-new';
    if (badge === 'Low stock') return ' is-low';
    return '';
  }
  function productCard(p) {
    var off = p.compareAt && p.compareAt > p.price ? p.compareAt - p.price : 0;
    var cat = categoryBySlug(p.category);
    var out = p.stock <= 0 || !p.active;
    return '<article class="wb-product" data-sku="' + esc(p.sku) + '">' +
      (p.badge ? '<span class="wb-product__badge' + badgeClass(p.badge) + '">' + esc(p.badge) + '</span>' : '') +
      '<a class="wb-product__media" href="' + esc(productUrl(p)) + '" style="background:' + esc(p.tint) + '">' +
      esc(p.emoji) + '</a>' +
      '<div class="wb-product__body">' +
      '<a class="wb-product__name" href="' + esc(productUrl(p)) + '">' + esc(p.name) + '</a>' +
      '<p class="wb-product__blurb">' + esc(p.blurb) + '</p>' +
      '<div class="wb-product__meta">' + stars(p.rating) + ' ' + esc(p.rating) + ' (' + p.reviews + ') ' +
      (cat ? '&middot; ' + esc(cat.name) : '') + '</div>' +
      '<div class="wb-product__price"><b>' + money(p.price) + '</b>' +
      (off ? '<s>' + money(p.compareAt) + '</s><em>-' + money(off) + '</em>' : '') + '</div>' +
      stockLine(p) +
      '<div class="wb-product__actions">' +
      '<button class="wb-btn wb-btn--primary" data-wb-add="' + esc(p.sku) + '"' + (out ? ' disabled' : '') + '>' +
      (out ? 'Unavailable' : 'Add to cart') + '</button>' +
      '<button class="wb-btn wb-btn--ghost" data-wb-wish="' + esc(p.sku) + '" title="Save for later">' +
      (wishlist().indexOf(p.sku) === -1 ? '\u2661' : '\u2665') + '</button>' +
      '</div></div></article>';
  }

  /* --------------------------------------------------------- grid/filters */

  function visibleProducts(f, root) {
    var list = PRODUCTS.filter(function (p) {
      if (!p.active && !params(root).all) return false;
      if (f.cat && p.category !== f.cat) return false;
      if (f.min !== '' && p.price < Number(f.min)) return false;
      if (f.max !== '' && p.price > Number(f.max)) return false;
      if (f.q) {
        var needle = String(f.q).toLowerCase();
        var hay = (p.name + ' ' + p.blurb + ' ' + p.sku + ' ' + p.category).toLowerCase();
        if (hay.indexOf(needle) === -1) return false;
      }
      return true;
    });
    list.sort(function (a, b) {
      if (f.sort === 'price-asc') return a.price - b.price;
      if (f.sort === 'price-desc') return b.price - a.price;
      if (f.sort === 'rating') return b.rating - a.rating;
      if (f.sort === 'newest') return (b.badge === 'New') - (a.badge === 'New');
      return (b.reviews) - (a.reviews);
    });
    return list;
  }

  function renderGrid(root, opts) {
    opts = opts || {};
    var f = filters();
    var list = visibleProducts(f, root);
    if (opts.limit) list = list.slice(0, opts.limit);
    var html = '';
    html += '<div class="wb-shop__toolbar wb-noprint">' +
      '<div class="wb-shop__cats"><button class="wb-shop__cat' + (f.cat === '' ? ' is-active' : '') +
      '" data-wb-cat="">All</button>' +
      CATEGORIES.map(function (c) {
        return '<button class="wb-shop__cat' + (f.cat === c.slug ? ' is-active' : '') +
          '" data-wb-cat="' + esc(c.slug) + '">' + esc(c.emoji) + ' ' + esc(c.name) + '</button>';
      }).join('') + '</div>' +
      '<div class="wb-shop__field"><label for="wb-q">\u2315</label>' +
      '<input id="wb-q" type="search" placeholder="Search products" value="' + esc(f.q) +
      '" data-wb-filter="q" style="width:130px"></div>' +
      '<div class="wb-shop__field"><select data-wb-filter="sort">' +
      [['featured', 'Most popular'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'],
       ['rating', 'Top rated'], ['newest', 'Newest']].map(function (o) {
        return '<option value="' + o[0] + '"' + (f.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></div>' +
      '<div class="wb-shop__field"><label for="wb-min">$</label>' +
      '<input id="wb-min" type="number" min="0" placeholder="Min" value="' + esc(f.min) +
      '" data-wb-filter="min" style="width:64px">' +
      '<label for="wb-max">\u2013</label>' +
      '<input id="wb-max" type="number" min="0" placeholder="Max" value="' + esc(f.max) +
      '" data-wb-filter="max" style="width:64px"></div>' +
      (f.cat || f.q || f.min !== '' || f.max !== '' ? '<button class="wb-btn wb-btn--sm" data-wb-clear>Clear</button>' : '') +
      '</div>';
    html += '<div class="wb-shop__count">' + list.length + ' product' + (list.length === 1 ? '' : 's') +
      (SETTINGS.freeShippingOver ? ' &middot; free standard shipping over ' + money(SETTINGS.freeShippingOver) : '') +
      (SETTINGS.codEnabled === false ? '' : ' &middot; cash on delivery available') + '</div>';
    html += list.length
      ? '<div class="wb-shop__grid">' + list.map(productCard).join('') + '</div>'
      : '<div class="wb-shop__empty">No products match those filters. <button class="wb-btn wb-btn--sm" data-wb-clear>Reset</button></div>';
    root.innerHTML = html;
    root.setAttribute('data-wb-rendered', '1');
  }

  function renderFeatured(root) {
    var list = PRODUCTS.filter(function (p) { return p.active && p.badge; }).slice(0, params(root).limit || 4);
    root.innerHTML = '<div class="wb-shop__grid">' + list.map(productCard).join('') + '</div>';
    root.setAttribute('data-wb-rendered', '1');
  }

  /* ----------------------------------------------------- product detail */

  function renderProduct(root) {
    var slug = qp('product') || params(root).product;
    var p = productBySlug(slug) || PRODUCTS[0];
    if (!p) { root.innerHTML = '<div class="wb-shop__empty">No products yet.</div>'; return; }
    var seller = sellerById(p.seller);
    var cat = categoryBySlug(p.category);
    var off = p.compareAt && p.compareAt > p.price ? p.compareAt - p.price : 0;
    var specs = Object.keys(p.specs || {}).map(function (k) {
      return '<tr><th>' + esc(k) + '</th><td>' + esc(p.specs[k]) + '</td></tr>';
    }).join('');
    root.innerHTML =
      '<div class="wb-detail">' +
      '<div class="wb-detail__media" style="background:' + esc(p.tint) + '">' + esc(p.emoji) + '</div>' +
      '<div>' +
      (p.badge ? '<span class="wb-product__badge' + badgeClass(p.badge) + '" style="position:static">' + esc(p.badge) + '</span>' : '') +
      '<h2 style="margin:.3rem 0">' + esc(p.name) + '</h2>' +
      '<div class="wb-product__meta">' + stars(p.rating) + ' ' + esc(p.rating) + ' from ' + p.reviews + ' reviews ' +
      (cat ? '&middot; <a href="' + esc(SETTINGS.shopPath || '') + '?cat=' + esc(cat.slug) + '">' + esc(cat.name) + '</a>' : '') +
      (seller ? '&middot; sold by <strong>' + esc(seller.store) + '</strong>' : '') + '</div>' +
      '<p style="font-size:.88rem;color:#475569">' + esc(p.blurb) + '</p>' +
      '<div class="wb-detail__price">' + money(p.price) +
      (off ? '<s style="font-size:.9rem;color:#94a3b8">' + money(p.compareAt) + '</s>' +
        '<span class="wb-product__price"><em>-' + money(off) + '</em></span>' : '') + '</div>' +
      stockLine(p) +
      '<div style="display:flex;gap:.5rem;align-items:center;margin:.8rem 0">' +
      '<div class="wb-qty"><button data-wb-step="p-' + esc(p.sku) + '">\u2212</button>' +
      '<span id="wb-pq-' + esc(p.sku) + '">1</span>' +
      '<button data-wb-step="p+' + esc(p.sku) + '">+</button></div>' +
      '<button class="wb-btn wb-btn--primary" data-wb-add="' + esc(p.sku) + '" data-wb-qty-from="wb-pq-' + esc(p.sku) + '">Add to cart</button>' +
      '<button class="wb-btn wb-btn--ghost" data-wb-wish="' + esc(p.sku) + '">' +
      (wishlist().indexOf(p.sku) === -1 ? 'Save for later' : 'Saved') + '</button>' +
      (SETTINGS.codEnabled === false ? '' :
        '<button class="wb-btn wb-btn--ghost" data-wb-addnow="' + esc(p.sku) + '" data-wb-qty-from="wb-pq-' + esc(p.sku) + '">Buy now</button>') +
      '</div>' +
      (SETTINGS.codEnabled === false ? '' :
        '<div class="wb-cod" style="margin-bottom:.8rem"><p class="wb-cod__title">\ud83d\udcb0 Cash on delivery</p>' +
        '<p class="wb-cod__hint">Pay the courier in cash when the parcel arrives. A ' + money(SETTINGS.codFee || 0) +
        ' handling fee applies, and free standard shipping kicks in over ' + money(SETTINGS.freeShippingOver || 0) + '.</p></div>') +
      '<table class="wb-detail__specs">' + specs + '</table>' +
      '</div></div>' +
      '<div data-wb-shop="reviews" data-product="' + esc(p.slug) + '" data-wb-rendered="1"></div>';
    root.setAttribute('data-wb-rendered', '1');
    var reviews = root.querySelector('[data-wb-shop="reviews"]');
    if (reviews) renderReviews(reviews);
  }

  function renderReviews(root) {
    var slug = params(root).product || qp('product');
    var p = productBySlug(slug);
    var seed = [
      { who: 'Dana R.', rating: 5, title: 'Exactly as described', body: 'Arrived two days early and the packaging was solid. Would order again.' },
      { who: 'Marcus T.', rating: 4, title: 'Great value', body: 'Does the job well. Knocked one star off only because the manual is thin.' },
      { who: 'Priya S.', rating: 5, title: 'Repeat buyer', body: 'Second unit I have bought. Same quality both times.' }
    ];
    var list = p ? seed : [];
    root.innerHTML =
      '<h3 style="font-weight:800;margin:.9rem 0 .4rem">' + (p ? p.reviews + ' reviews for ' + esc(p.name) : 'Reviews') + '</h3>' +
      list.map(function (r) {
        return '<div class="wb-rev"><div class="wb-rev__who">' + esc(r.who) + ' ' + stars(r.rating) + '</div>' +
          '<strong style="font-size:.8rem">' + esc(r.title) + '</strong>' +
          '<p style="margin:.15rem 0 0;color:#475569">' + esc(r.body) + '</p></div>';
      }).join('') +
      '<form class="wb-form" data-wb-review>' +
      '<div class="wb-form__grid">' +
      '<div class="wb-form__row"><label>Your name</label><input name="name" required placeholder="Jane Doe"></div>' +
      '<div class="wb-form__row"><label>Rating</label><select name="rating">' +
      [5, 4, 3, 2, 1].map(function (n) { return '<option value="' + n + '">' + n + ' star' + (n > 1 ? 's' : '') + '</option>'; }).join('') +
      '</select></div></div>' +
      '<div class="wb-form__row"><label>Review title</label><input name="title" placeholder="Sum it up in a few words"></div>' +
      '<div class="wb-form__row"><label>Your review</label><textarea name="body" rows="3" placeholder="What did you like or dislike?"></textarea></div>' +
      '<button class="wb-btn wb-btn--primary">Post review</button></form>';
  }

  /* ---------------------------------------------------------- wishlist */

  function renderWishlist(root) {
    var list = wishlist().map(productBySku).filter(Boolean);
    root.innerHTML = list.length
      ? '<div class="wb-shop__grid">' + list.map(productCard).join('') + '</div>'
      : '<div class="wb-shop__empty">Your wishlist is empty.</div>';
    root.setAttribute('data-wb-rendered', '1');
  }

  /* -------------------------------------------------------------- cart */

  function linesHtml(t) {
    if (!t.lines.length) return '<div class="wb-shop__empty">Your cart is empty.</div>';
    return '<div class="wb-lines">' + t.lines.map(function (l) {
      var p = l.product;
      return '<div class="wb-line">' +
        '<div class="wb-line__media" style="background:' + esc(p.tint) + '">' + esc(p.emoji) + '</div>' +
        '<div><a class="wb-line__name" href="' + esc(productUrl(p)) + '">' + esc(p.name) + '</a>' +
        '<div class="wb-line__sku">' + esc(p.sku) + ' &middot; ' + money(p.price) + ' each</div>' +
        '<div style="display:flex;gap:.4rem;margin-top:.3rem">' +
        '<div class="wb-qty"><button data-wb-qty="' + esc(p.sku) + '" data-wb-delta="-1">&minus;</button>' +
        '<span>' + l.qty + '</span>' +
        '<button data-wb-qty="' + esc(p.sku) + '" data-wb-delta="1">+</button></div>' +
        '<button class="wb-btn wb-btn--sm wb-btn--danger" data-wb-remove="' + esc(p.sku) + '">Remove</button>' +
        '</div></div>' +
        '<div class="wb-line__price">' + money(l.total) + '</div></div>';
    }).join('') + '</div>';
  }

  function totalsHtml(t) {
    return '<div class="wb-totals">' +
      '<div><span>Subtotal (' + t.count + ' item' + (t.count === 1 ? '' : 's') + ')</span><span>' + money(t.subtotal) + '</span></div>' +
      (t.discount > 0 ? '<div style="color:#16a34a"><span>Discount ' + esc(t.coupon.code) + '</span><span>-' + money(t.discount) + '</span></div>' : '') +
      '<div><span>Shipping (' + esc(t.shippingRow.label) + ')</span><span>' + (t.shipping === 0 ? 'Free' : money(t.shipping)) + '</span></div>' +
      (t.codFee > 0 ? '<div><span>Cash on delivery fee</span><span>' + money(t.codFee) + '</span></div>' : '') +
      '<div><span>Tax (' + esc(SETTINGS.taxRate || 0) + '%)</span><span>' + money(t.tax) + '</span></div>' +
      '<div class="is-total"><span>Total</span><span>' + money(t.total) + '</span></div></div>' +
      '<div class="wb-coupon"><input data-wb-coupon-input placeholder="Coupon code" value="' + esc(couponCode()) + '">' +
      '<button class="wb-btn" data-wb-coupon>Apply</button>' +
      (couponCode() ? '<button class="wb-btn wb-btn--ghost" data-wb-coupon-clear>Clear</button>' : '') + '</div>' +
      (t.coupon && !t.couponUsable
        ? '<div class="wb-alert wb-alert--warn" style="margin-top:.5rem">Coupon ' + esc(t.coupon.code) +
          ' needs a subtotal of at least ' + money(t.coupon.min) + '.</div>' : '');
  }

  function renderCart(root) {
    var t = totals(cart());
    root.innerHTML = '<div class="wb-two"><div>' + linesHtml(t) + '</div>' +
      '<div><div class="wb-panel"><h3 class="wb-panel__title">Order summary</h3>' + totalsHtml(t) +
      '<a class="wb-btn wb-btn--primary wb-btn--block" href="' + esc(SETTINGS.checkoutPath || 'checkout.html') +
      '" style="margin-top:.7rem"' + (t.count ? '' : ' disabled') + '>Proceed to checkout</a>' +
      (SETTINGS.codEnabled === false ? '' :
        '<p class="wb-form__note" style="margin-top:.5rem">Cash on delivery is available at checkout.</p>') +
      '</div></div></div>';
    root.setAttribute('data-wb-rendered', '1');
  }

  /* ------------------------------------------------------------ COD form */

  var COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Ireland', 'Australia', 'New Zealand',
    'Germany', 'France', 'Netherlands', 'Spain', 'Italy', 'UAE', 'Saudi Arabia', 'India', 'Pakistan',
    'Bangladesh', 'Nigeria', 'Kenya', 'South Africa', 'Brazil', 'Mexico', 'Other'];
  var DELIVERY_WINDOWS = ['Any time', 'Morning (9am - 12pm)', 'Afternoon (12pm - 5pm)', 'Evening (5pm - 9pm)'];
  var CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'PKR', 'INR', 'BDT', 'NGN', 'KES', 'ZAR', 'BRL', 'MXN'];

  function row(label, inner, extra) {
    return '<div class="wb-form__row"' + (extra || '') + '><label>' + label + '</label>' + inner +
      '<div class="wb-form__err" data-err></div></div>';
  }
  function input(name, opts) {
    opts = opts || {};
    return '<input name="' + name + '" value="' + esc(opts.value || '') + '"' +
      (opts.type ? ' type="' + opts.type + '"' : '') +
      (opts.required ? ' required' : '') +
      (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '') +
      (opts.autocomplete ? ' autocomplete="' + opts.autocomplete + '"' : '') +
      (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : '') + '>';
  }
  function select(name, options, value, opts) {
    opts = opts || {};
    return '<select name="' + name + '"' + (opts.required ? ' required' : '') + '>' +
      options.map(function (o) {
        var val = typeof o === 'string' ? o : o[0], label = typeof o === 'string' ? o : o[1];
        return '<option value="' + esc(val) + '"' + (String(value) === String(val) ? ' selected' : '') +
          '>' + esc(label) + '</option>';
      }).join('') + '</select>';
  }
  function field(name) {
    return document.querySelector('[data-wb-checkout] [name="' + name + '"]');
  }
  function value(name) {
    var el = field(name);
    if (!el) return '';
    if (el.type === 'checkbox') return el.checked;
    return String(el.value || '').trim();
  }
  function setError(name, message) {
    var el = field(name);
    if (!el) return;
    var wrap = el.closest('.wb-form__row');
    if (wrap) {
      wrap.classList.toggle('is-error', !!message);
      var slot = wrap.querySelector('[data-err]');
      if (slot) slot.textContent = message || '';
    }
  }
  function clearErrors(form) {
    Array.prototype.forEach.call(form.querySelectorAll('.wb-form__row.is-error'), function (r) {
      r.classList.remove('is-error');
      var slot = r.querySelector('[data-err]');
      if (slot) slot.textContent = '';
    });
  }

  /** Every delivery field a courier actually needs, marked required where it matters. */
  function codInfoFields(t) {
    return '<div class="wb-cod">' +
      '<p class="wb-cod__title">\ud83d\udcb0 Cash on delivery details</p>' +
      '<p class="wb-cod__hint">' + esc(SETTINGS.codNote || '') + '</p>' +
      '<div class="wb-cod__grid" style="margin-top:.6rem">' +
      row('Cash to collect on delivery <span>*</span>',
        input('cod_amount', { type: 'number', value: t.total, required: true, inputmode: 'decimal' }),
        ' data-field="cod_amount"') +
      row('Currency to collect in',
        select('cod_currency', CURRENCIES, SETTINGS.currencyCode || 'USD'), ' data-field="cod_currency"') +
      row('Who will pay the courier?',
        select('cod_payer', [['me', 'Me (the customer)'], ['receiver', 'The person receiving the parcel'],
          ['other', 'Someone else']], 'me'), ' data-field="cod_payer"') +
      row('Receiver name',
        input('cod_receiver_name', { placeholder: 'If someone else receives it' }),
        ' data-field="cod_receiver_name" data-when-payer="receiver other" style="display:none"') +
      row('Receiver phone',
        input('cod_receiver_phone', { type: 'tel', inputmode: 'tel', placeholder: '+1 555 0000' }),
        ' data-field="cod_receiver_phone" data-when-payer="receiver other" style="display:none"') +
      row('ID type',
        select('cod_id_type', ['No ID required', 'National ID', 'Passport', 'Driving licence'], 'No ID required'),
        ' data-field="cod_id_type"') +
      row('ID number',
        input('cod_id_number', { placeholder: 'Optional, speeds up verification' }),
        ' data-field="cod_id_number"') +
      '</div>' +
      '<div class="wb-form__row" style="margin-top:.6rem"><label>Instructions for the courier</label>' +
      '<textarea name="cod_instructions" rows="3">' + esc(SETTINGS.codNote || '') + '</textarea></div>' +
      '<div class="wb-form__row" style="margin-top:.6rem">' +
      '<label class="wb-form__check"><input type="checkbox" name="cod_consent">' +
      '<span>I confirm I (or the person named above) will have <strong>' + money(t.total) + '</strong> in exact cash ' +
      'ready for the courier on delivery.</span></label>' +
      '<div class="wb-form__err" data-err></div></div>' +
      '<div class="wb-form__row"><label class="wb-form__check">' +
      '<input type="checkbox" name="cod_reschedule" checked>' +
      '<span>Allow the courier to reschedule if nobody is home</span></label></div>' +
      '</div>';
  }

  function renderCheckout(root) {
    var items = cart();
    if (!items.length) {
      root.innerHTML = '<div class="wb-shop__empty">Your cart is empty &mdash; ' +
        '<a href="' + esc(SETTINGS.shopPath || '') + '">browse the catalog</a> to add something.</div>';
      root.setAttribute('data-wb-rendered', '1');
      return;
    }
    var t = totals(items);
    var saved = read('wb_checkout_draft', {}) || {};
    var codOn = SETTINGS.codEnabled !== false;

    root.innerHTML = '<form class="wb-two wb-form" data-wb-checkout novalidate>' +
      '<div>' +
      '<div class="wb-panel"><h3 class="wb-panel__title">1. Contact information</h3>' +
      '<div class="wb-form__grid">' +
      row('Full name <span>*</span>', input('name', { value: saved.name, required: true, autocomplete: 'name' }), ' data-field="name"') +
      row('Email address <span>*</span>', input('email', { type: 'email', value: saved.email, required: true, autocomplete: 'email' }), ' data-field="email"') +
      row('Phone number <span>*</span>', input('phone', { type: 'tel', value: saved.phone, required: true, inputmode: 'tel', autocomplete: 'tel', placeholder: '+1 555 0000' }), ' data-field="phone"') +
      '</div></div>' +

      '<div class="wb-panel"><h3 class="wb-panel__title">2. Delivery address</h3>' +
      '<div class="wb-form__grid">' +
      row('Address line 1 <span>*</span>', input('line1', { value: saved.line1, required: true, autocomplete: 'address-line1' }), ' data-field="line1"') +
      row('Address line 2', input('line2', { value: saved.line2, autocomplete: 'address-line2' }), ' data-field="line2"') +
      row('City <span>*</span>', input('city', { value: saved.city, required: true, autocomplete: 'address-level2' }), ' data-field="city"') +
      row('State / province', input('state', { value: saved.state, autocomplete: 'address-level1' }), ' data-field="state"') +
      row('Postal / ZIP code <span>*</span>', input('postal_code', { value: saved.postal_code, required: true, autocomplete: 'postal-code' }), ' data-field="postal_code"') +
      row('Country <span>*</span>', select('country', COUNTRIES, saved.country || 'United States', { required: true }), ' data-field="country"') +
      '</div></div>' +

      '<div class="wb-panel"><h3 class="wb-panel__title">3. Delivery options</h3>' +
      SHIPPING.map(function (s) {
        return '<label class="wb-choice' + (shippingMethod() === s.id ? ' is-active' : '') +
          '" style="margin-bottom:.4rem"><input type="radio" name="shipping_method" value="' + esc(s.id) + '"' +
          (shippingMethod() === s.id ? ' checked' : '') + '>' +
          '<span><span class="wb-choice__t">' + esc(s.emoji) + ' ' + esc(s.label) + '</span>' +
          '<span class="wb-choice__h">' + esc(s.days) + ' &middot; ' +
          (s.fee === 0 ? 'Free' : money(s.fee)) + '</span></span></label>';
      }).join('') +
      '<div class="wb-form__grid" style="margin-top:.6rem">' +
      row('Preferred delivery date', input('delivery_date', { type: 'date' }), ' data-field="delivery_date"') +
      row('Preferred time window', select('delivery_window', DELIVERY_WINDOWS, 'Any time'), ' data-field="delivery_window"') +
      '</div>' +
      '<div class="wb-form__row"><label class="wb-form__check"><input type="checkbox" name="gift_wrap" checked>' +
      '<span>Wrap the parcel in gift paper (+' + money(3) + ')</span></label></div>' +
      '<div class="wb-form__row"><label>Delivery notes for the courier</label>' +
      '<textarea name="delivery_notes" rows="2" placeholder="Gate code, buzzer number, best time to call"></textarea></div>' +
      '</div>' +

      '<div class="wb-panel"><h3 class="wb-panel__title">4. Payment method</h3>' +
      PAYMENTS.filter(function (p) { return codOn || p.id !== 'cod'; }).map(function (p) {
        return '<label class="wb-choice' + (p.id === 'cod' ? ' is-active' : '') + '" style="margin-bottom:.4rem">' +
          '<input type="radio" name="payment_method" value="' + esc(p.id) + '"' +
          (p.id === 'cod' ? ' checked' : '') + ' data-wb-payment="' + esc(p.id) + '">' +
          '<span><span class="wb-choice__t">' + esc(p.emoji) + ' ' + esc(p.label) + '</span>' +
          '<span class="wb-choice__h">' + esc(p.hint) +
          (p.id === 'cod' && SETTINGS.codFee ? ' &middot; ' + money(SETTINGS.codFee) + ' handling fee' : '') +
          '</span></span></label>';
      }).join('') +
      '<div data-wb-when-payment="cod" style="margin-top:.7rem">' + codInfoFields(t) + '</div>' +
      '<div data-wb-when-payment="card" style="display:none;margin-top:.7rem" class="wb-form__grid">' +
      row('Card number <span>*</span>', input('card_number', { inputmode: 'numeric', placeholder: '4242 4242 4242 4242' }), ' data-field="card_number"') +
      row('Name on card <span>*</span>', input('card_name', { placeholder: 'As printed' }), ' data-field="card_name"') +
      row('Expiry <span>*</span>', input('card_exp', { placeholder: 'MM/YY' }), ' data-field="card_exp"') +
      row('CVC <span>*</span>', input('card_cvc', { inputmode: 'numeric', placeholder: '123' }), ' data-field="card_cvc"') +
      '</div>' +
      '<div data-wb-when-payment="bank" style="display:none;margin-top:.7rem" class="wb-alert wb-alert--info">' +
      'Bank transfer details are emailed to you once the order is confirmed.</div>' +
      '</div>' +
      '</div>' +

      '<div><div class="wb-panel"><h3 class="wb-panel__title">Order summary</h3>' +
      '<div class="wb-lines">' + t.lines.map(function (l) {
        return '<div class="wb-line"><div class="wb-line__media" style="background:' + esc(l.product.tint) + '">' +
          esc(l.product.emoji) + '</div><div><a class="wb-line__name" href="' + esc(productUrl(l.product)) + '">' +
          esc(l.product.name) + '</a><div class="wb-line__sku">' + l.qty + ' &times; ' + money(l.product.price) + '</div></div>' +
          '<div class="wb-line__price">' + money(l.total) + '</div></div>';
      }).join('') + '</div>' +
      totalsHtml(t) +
      '<div data-wb-checkout-alert></div>' +
      '<button class="wb-btn wb-btn--primary wb-btn--block" style="margin-top:.7rem" data-wb-place>' +
      'Place order</button>' +
      '<p class="wb-form__note" style="margin-top:.4rem">By placing the order you agree to be contacted about delivery.</p>' +
      '</div></div></form>';
    root.setAttribute('data-wb-rendered', '1');
    syncCodVisibility(root);
  }

  function syncCodVisibility(root) {
    var payer = value('cod_payer');
    Array.prototype.forEach.call(root.querySelectorAll('[data-when-payer]'), function (el) {
      var wanted = String(el.getAttribute('data-when-payer') || '').split(' ');
      el.style.display = wanted.indexOf(payer) === -1 ? 'none' : '';
    });
    var payment = value('payment_method') || 'cod';
    Array.prototype.forEach.call(root.querySelectorAll('[data-wb-when-payment]'), function (el) {
      el.style.display = el.getAttribute('data-wb-when-payment') === payment ? '' : 'none';
    });
    Array.prototype.forEach.call(root.querySelectorAll('.wb-choice input[type=radio]'), function (radio) {
      var wrap = radio.closest('.wb-choice');
      if (wrap) wrap.classList.toggle('is-active', radio.checked);
    });
  }

  /* ---------------------------------------------------------- validation */

  function validateCheckout(form) {
    clearErrors(form);
    var errors = [];
    var required = [
      ['name', 'Enter the full name for the delivery.'],
      ['email', 'We need an email for the order confirmation.'],
      ['phone', 'A phone number is required for delivery calls.'],
      ['line1', 'Enter the street address.'],
      ['city', 'Enter the city.'],
      ['postal_code', 'Enter the postal or ZIP code.'],
      ['country', 'Choose a country.']
    ];
    required.forEach(function (pair) {
      if (!value(pair[0])) { setError(pair[0], pair[1]); errors.push(pair[1]); }
    });
    var email = value('email');
    if (email && email.indexOf('@') === -1) {
      setError('email', 'That email address is not valid.');
      errors.push('bad email');
    }
    var phone = value('phone').replace(/[^0-9]/g, '');
    if (phone && phone.length < 7) {
      setError('phone', 'That phone number looks too short.');
      errors.push('bad phone');
    }
    var zip = value('postal_code');
    if (zip && zip.replace(/[^0-9A-Za-z-]/g, '').length < 3) {
      setError('postal_code', 'Enter a valid postal code.');
      errors.push('bad zip');
    }

    var payment = value('payment_method') || 'cod';
    if (payment === 'card') {
      [['card_number', 'Enter the card number.'], ['card_name', 'Enter the name on the card.'],
       ['card_exp', 'Enter the expiry date.'], ['card_cvc', 'Enter the CVC.']].forEach(function (pair) {
        if (!value(pair[0])) { setError(pair[0], pair[1]); errors.push(pair[1]); }
      });
      var digits = value('card_number').replace(/[^0-9]/g, '');
      if (digits && (digits.length < 13 || digits.length > 19)) {
        setError('card_number', 'A card number is 13 to 19 digits.');
        errors.push('bad card');
      }
    }
    if (payment === 'cod' && SETTINGS.codEnabled !== false) {
      var amount = Number(value('cod_amount'));
      if (!value('cod_amount') || !isFinite(amount) || amount <= 0) {
        setError('cod_amount', 'Enter the cash amount the courier should collect.');
        errors.push('cod amount');
      }
      if (value('cod_payer') !== 'me') {
        if (!value('cod_receiver_name')) {
          setError('cod_receiver_name', 'Enter who will receive the parcel.');
          errors.push('cod receiver');
        }
        if (value('cod_receiver_phone').replace(/[^0-9]/g, '').length < 7) {
          setError('cod_receiver_phone', 'Enter a reachable phone number.');
          errors.push('cod receiver phone');
        }
      }
      if (!value('cod_consent')) {
        setError('cod_consent', 'Please confirm you will have the exact cash ready.');
        errors.push('cod consent');
      }
    }
    return errors;
  }

  function collectCheckout(t) {
    return {
      action: 'createOrder',
      items: cart(),
      coupon: couponCode(),
      customer: { name: value('name'), email: value('email').toLowerCase(), phone: value('phone') },
      address: {
        line1: value('line1'), line2: value('line2'), city: value('city'), state: value('state'),
        postal_code: value('postal_code'), country: value('country')
      },
      delivery: {
        method: value('shipping_method') || 'standard',
        date: value('delivery_date'),
        window: value('delivery_window'),
        notes: value('delivery_notes'),
        gift_wrap: !!value('gift_wrap')
      },
      payment: {
        method: value('payment_method') || 'cod',
        card_number: value('card_number'),
        card_name: value('card_name'),
        card_exp: value('card_exp'),
        card_cvc: value('card_cvc'),
        paypal_email: value('email')
      },
      cod: SETTINGS.codEnabled === false ? null : {
        amount: Number(value('cod_amount')) || t.total,
        currency: value('cod_currency') || SETTINGS.currencyCode,
        payer: value('cod_payer') || 'me',
        receiver_name: value('cod_receiver_name'),
        receiver_phone: value('cod_receiver_phone'),
        id_type: value('cod_id_type'),
        id_number: value('cod_id_number'),
        instructions: value('cod_instructions'),
        consent: !!value('cod_consent'),
        reschedule: !!value('cod_reschedule')
      }
    };
  }

  function placeOrder(button) {
    var form = document.querySelector('[data-wb-checkout]');
    if (!form) return;
    var slot = form.querySelector('[data-wb-checkout-alert]');
    var errors = validateCheckout(form);
    if (errors.length) {
      if (slot) slot.innerHTML = '<div class="wb-alert wb-alert--error">' + esc(errors[0]) + '</div>';
      var firstBad = form.querySelector('.wb-form__row.is-error input, .wb-form__row.is-error select');
      if (firstBad) firstBad.focus();
      return;
    }
    var items = cart();
    var t = totals(items, {
      shipping: value('shipping_method'),
      payment: value('payment_method')
    });
    write('wb_checkout_draft', {
      name: value('name'), email: value('email'), phone: value('phone'), line1: value('line1'),
      line2: value('line2'), city: value('city'), state: value('state'),
      postal_code: value('postal_code'), country: value('country')
    });
    var payload = collectCheckout(t);
    button.disabled = true;
    button.textContent = 'Placing your order\u2026';
    api(payload).then(function (res) {
      if (!res || !res.ok) {
        throw new Error((res && res.error) || 'We could not place the order.');
      }
      var order = res.order;
      var local = read('wb_orders_v1', []);
      local.unshift(order);
      write('wb_orders_v1', local.slice(0, 25));
      setCart([]);
      window.location.href = (SETTINGS.confirmationPath || 'order-confirmation.html') + '?order=' +
        encodeURIComponent(order.order_no);
    })['catch'](function (err) {
      button.disabled = false;
      button.textContent = 'Place order';
      if (slot) slot.innerHTML = '<div class="wb-alert wb-alert--error">' + esc(err.message) + '</div>';
    });
  }

  /* ------------------------------------------------- confirmation / track */

  function localOrders() { return read('wb_orders_v1', []) || []; }
  function localOrder(no) {
    var list = localOrders();
    for (var i = 0; i < list.length; i++) if (list[i].order_no === no) return list[i];
    return null;
  }

  function statusTimeline(status) {
    var flow = ['confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered'];
    var idx = STATUS_ORDER.indexOf(status);
    var items = ['pending'].concat(flow);
    return '<ul class="wb-timeline">' + items.map(function (id) {
      var done = idx > items.indexOf(id);
      var now = id === status;
      return '<li class="' + (done ? 'is-done' : now ? 'is-now' : '') + '"><span class="wb-dot"></span>' +
        esc(STATUS_LABEL[id] || id) + (now ? ' \u2014 current' : '') + '</li>';
    }).join('') + '</ul>';
  }

  function orderDetailHtml(o) {
    var cod = o.payment_method === 'cod';
    var eta = o.eta || (o.created_at ? String(o.created_at).slice(0, 10) : '');
    return '<div class="wb-panel"><h3 class="wb-panel__title">Order ' + esc(o.order_no) +
      ' <span class="wb-pill" style="background:#334155">' + esc(STATUS_LABEL[o.status] || o.status) + '</span></h3>' +
      '<div class="wb-form__grid">' +
      '<div><div class="wb-kpi"><span>Placed</span><b style="font-size:.9rem">' + esc(String(o.created_at || '').slice(0, 10)) + '</b></div></div>' +
      '<div><div class="wb-kpi"><span>Payment</span><b style="font-size:.9rem">' + esc(String(o.payment_method || '').toUpperCase()) + '</b></div></div>' +
      '<div><div class="wb-kpi"><span>Delivery</span><b style="font-size:.9rem">' + esc(eta) + '</b></div></div>' +
      '<div><div class="wb-kpi"><span>Total</span><b>' + money(o.total) + '</b></div></div>' +
      '</div>' +
      '<div class="wb-lines">' + (o.items || []).map(function (line) {
        return '<div class="wb-line"><div class="wb-line__media">' + esc(line.emoji || '\ud83d\udce6') + '</div>' +
          '<div><span class="wb-line__name">' + esc(line.name) + '</span>' +
          '<div class="wb-line__sku">' + esc(line.sku) + ' &middot; ' + line.qty + ' &times; ' + money(line.price) + '</div></div>' +
          '<div class="wb-line__price">' + money(line.qty * line.price) + '</div></div>';
      }).join('') + '</div>' +
      '<div class="wb-totals">' +
      '<div><span>Subtotal</span><span>' + money(o.subtotal) + '</span></div>' +
      (Number(o.discount) > 0 ? '<div><span>Discount</span><span>-' + money(o.discount) + '</span></div>' : '') +
      '<div><span>Shipping</span><span>' + (Number(o.shipping_fee) === 0 ? 'Free' : money(o.shipping_fee)) + '</span></div>' +
      (Number(o.cod_fee) > 0 ? '<div><span>COD fee</span><span>' + money(o.cod_fee) + '</span></div>' : '') +
      '<div><span>Tax</span><span>' + money(o.tax) + '</span></div>' +
      '<div class="is-total"><span>Total</span><span>' + money(o.total) + '</span></div></div>' +
      (cod
        ? '<div class="wb-cod" style="margin-top:.8rem"><p class="wb-cod__title">\ud83d\udcb0 Pay the courier</p>' +
          '<div class="wb-cod__amount">' + money(o.cod_amount) + '</div>' +
          '<p class="wb-cod__hint">Cash to collect on delivery (' + esc(o.cod_currency || SETTINGS.currencyCode) + '). ' +
          esc(SETTINGS.codNote || '') + '</p>' +
          '<div class="wb-cod__grid" style="margin-top:.5rem">' +
          '<div class="wb-kpi"><span>Paid by</span><b style="font-size:.9rem">' +
          esc(String(o.cod_payer || 'me').replace(/^./, function (c) { return c.toUpperCase(); })) + '</b></div>' +
          '<div class="wb-kpi"><span>Collection status</span><b style="font-size:.9rem">' +
          esc(o.cod_status || 'pending') + '</b></div>' +
          (o.cod_receiver_name
            ? '<div class="wb-kpi"><span>Receiving</span><b style="font-size:.9rem">' + esc(o.cod_receiver_name) + '</b></div>'
            : '') +
          '</div>' + (o.cod_instructions
            ? '<p class="wb-cod__hint" style="margin-top:.4rem">Note to courier: ' + esc(o.cod_instructions) + '</p>' : '') +
          '</div>'
        : '') +
      statusTimeline(o.status) +
      '<div style="display:flex;gap:.4rem;margin-top:.8rem" class="wb-noprint">' +
      '<a class="wb-btn wb-btn--ghost" href="' + esc(SETTINGS.trackPath || 'track-order.html') +
      '?order=' + encodeURIComponent(o.order_no) + '">Track this order</a>' +
      '<button class="wb-btn wb-btn--ghost" onclick="window.print()">Print receipt</button>' +
      '</div></div>';
  }

  function renderConfirmation(root) {
    var no = qp('order');
    var local = no ? localOrder(no) : null;
    if (local) {
      root.innerHTML = '<div class="wb-alert wb-alert--ok">Thank you! Your order is confirmed. ' +
        'We emailed a copy to ' + esc(local.email || 'your inbox') + '.</div>' + orderDetailHtml(local);
      root.setAttribute('data-wb-rendered', '1');
      return;
    }
    if (!no) {
      root.innerHTML = '<div class="wb-shop__empty">No order number given.</div>';
      return;
    }
    root.innerHTML = '<p class="wb-form__note">Loading order ' + esc(no) + '\u2026</p>';
    api({ action: 'lookupOrder', order_no: no }).then(function (res) {
      if (!res || !res.ok) throw new Error((res && res.error) || 'Order not found.');
      root.innerHTML = '<div class="wb-alert wb-alert--ok">Thank you! Your order is confirmed.</div>' +
        orderDetailHtml(res.order);
    })['catch'](function (err) {
      root.innerHTML = '<div class="wb-alert wb-alert--error">' + esc(err.message) + '</div>';
    });
    root.setAttribute('data-wb-rendered', '1');
  }

  function renderTrack(root) {
    root.innerHTML = '<form class="wb-form" data-wb-track style="max-width:520px">' +
      '<div class="wb-form__grid">' +
      row('Order number <span>*</span>', input('order_no', { value: qp('order') || '', required: true, placeholder: 'WB-000123' }), ' data-field="order_no"') +
      row('Phone number on the order <span>*</span>', input('phone', { type: 'tel', inputmode: 'tel', required: true }), ' data-field="phone"') +
      '</div><button class="wb-btn wb-btn--primary">Track order</button>' +
      '<div data-wb-track-alert></div></form><div data-wb-track-result></div>';
    root.setAttribute('data-wb-rendered', '1');
  }

  function trackOrder(form) {
    var no = value('order_no');
    var phone = value('phone').replace(/[^0-9]/g, '');
    var slot = form.querySelector('[data-wb-track-alert]');
    var out = document.querySelector('[data-wb-track-result]');
    if (!no || phone.length < 7) {
      if (slot) slot.innerHTML = '<div class="wb-alert wb-alert--error">Enter your order number and the phone number used at checkout.</div>';
      return;
    }
    api({ action: 'lookupOrder', order_no: no, phone: phone }).then(function (res) {
      if (!res || !res.ok) {
        if (slot) slot.innerHTML = '<div class="wb-alert wb-alert--error">' +
          esc((res && res.error) || 'We could not find that order.') + '</div>';
        return;
      }
      if (slot) slot.innerHTML = '';
      if (out) out.innerHTML = orderDetailHtml(res.order);
    })['catch'](function (err) {
      if (slot) slot.innerHTML = '<div class="wb-alert wb-alert--error">' + esc(err.message) + '</div>';
    });
  }

  /* ---------------------------------------------------------------- api */

  /**
   * When the site is served by the generated PHP/Node app the order really is
   * written to disk; when the page is opened straight from disk (preview, static
   * export) the same call is answered by a local store so the whole COD flow is
   * still testable without a server.
   */
  function LocalBackend() {
    this.orders = read('wb_backend_orders', null);
    if (!this.orders) { this.orders = []; write('wb_backend_orders', this.orders); }
  }
  LocalBackend.prototype.call = function (payload) {
    var self = this;
    if (payload.action === 'createOrder') {
      var items = (payload.items || []).map(function (line) {
        var p = productBySku(line.sku);
        if (!p) return null;
        return { sku: p.sku, name: p.name, price: p.price, qty: line.qty, seller_id: p.seller, emoji: p.emoji };
      }).filter(Boolean);
      if (!items.length) return Promise.resolve({ ok: false, error: 'Your cart is empty.' });
      var t = totals(payload.items || [], { shipping: payload.delivery.method, payment: payload.payment.method });
      var n = self.orders.length + 1;
      var order = {
        order_no: 'WB-' + String(100000 + n),
        created_at: new Date().toISOString(),
        status: 'pending',
        customer: payload.customer,
        address: payload.address,
        delivery: payload.delivery,
        items: items,
        cod: payload.cod,
        cod_amount: payload.cod ? payload.cod.amount : 0,
        cod_currency: payload.cod ? payload.cod.currency : SETTINGS.currencyCode,
        cod_payer: payload.cod ? payload.cod.payer : '',
        cod_receiver_name: payload.cod ? payload.cod.receiver_name : '',
        cod_instructions: payload.cod ? payload.cod.instructions : '',
        cod_status: payload.cod ? 'pending' : '',
        payment_method: payload.payment.method,
        shipping_method: payload.delivery.method,
        shipping_fee: t.shipping,
        cod_fee: t.codFee,
        tax: t.tax,
        discount: t.discount,
        subtotal: t.subtotal,
        total: t.total,
        email: payload.customer.email,
        phone: payload.customer.phone,
        eta: String(new Date(Date.now() + 5 * 86400000)).slice(0, 10)
      };
      self.orders.unshift(order);
      write('wb_backend_orders', self.orders.slice(0, 100));
      return Promise.resolve({ ok: true, order: order, local: true });
    }
    if (payload.action === 'lookupOrder') {
      var no = String(payload.order_no || '').toUpperCase();
      for (var i = 0; i < self.orders.length; i++) {
        var o = self.orders[i];
        if (o.order_no.toUpperCase() !== no) continue;
        if (payload.phone) {
          var a = String(payload.phone).replace(/[^0-9]/g, '');
          var b = String(o.phone || '').replace(/[^0-9]/g, '');
          if (a && b && a.slice(-7) !== b.slice(-7)) {
            return Promise.resolve({ ok: false, error: 'The phone number does not match this order.' });
          }
        }
        return Promise.resolve({ ok: true, order: o, local: true });
      }
      return Promise.resolve({ ok: false, error: 'We could not find that order number.' });
    }
    return Promise.resolve({ ok: false, error: 'Unknown action.' });
  };

  var localBackend = null;
  function api(payload) {
    var body = JSON.stringify(payload);
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: body
    }).then(function (res) {
      if (res.status === 404 || res.status === 501) throw new Error('no-server');
      return res.json().catch(function () { throw new Error('bad-response'); });
    })['catch'](function () {
      if (!localBackend) localBackend = new LocalBackend();
      return localBackend.call(payload);
    });
  }

  /* ------------------------------------------------------------ handlers */

  var RENDERERS = {
    grid: renderGrid,
    featured: renderFeatured,
    product: renderProduct,
    reviews: renderReviews,
    cart: renderCart,
    checkout: renderCheckout,
    confirmation: renderConfirmation,
    track: renderTrack,
    wishlist: renderWishlist
  };

  function renderBlock(root) {
    var kind = root.getAttribute('data-wb-shop');
    var fn = RENDERERS[kind];
    if (fn) fn(root);
    else if (window.WBShop && typeof window.WBShop.panels[kind] === 'function') {
      window.WBShop.panels[kind](root, api);
    }
  }

  /** Never redraw a block the user is typing in. */
  function busy(root) {
    var active = document.activeElement;
    return !!active && root.contains && root.contains(active) &&
      /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName);
  }

  function rerender() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-wb-shop]'), function (root) {
      if (busy(root)) return;
      renderBlock(root);
    });
  }
  on(rerender);

  function qtyFrom(id) {
    var el = id && document.getElementById(id);
    return el ? Math.max(1, parseInt(el.textContent, 10) || 1) : 1;
  }

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-wb-add],[data-wb-addnow],[data-wb-wish],' +
      '[data-wb-remove],[data-wb-qty],[data-wb-cat],[data-wb-clear],[data-wb-coupon],[data-wb-coupon-clear],' +
      '[data-wb-place],[data-wb-step],[data-wb-shop-toggle]') : null;
    if (!el) return;
    var attr = function (name) { return el.getAttribute(name); };

    if (attr('data-wb-add') || attr('data-wb-addnow')) {
      var sku = attr('data-wb-add') || attr('data-wb-addnow');
      addToCart(sku, qtyFrom(attr('data-wb-qty-from')));
      if (attr('data-wb-addnow')) {
        window.location.href = SETTINGS.checkoutPath || 'checkout.html';
      }
      return;
    }
    if (attr('data-wb-wish')) { toggleWish(attr('data-wb-wish')); return; }
    if (attr('data-wb-remove')) { removeFromCart(attr('data-wb-remove')); return; }
    if (attr('data-wb-qty')) {
      var line = null;
      cart().forEach(function (i) { if (i.sku === attr('data-wb-qty')) line = i; });
      if (line) setQty(line.sku, line.qty + Number(attr('data-wb-delta') || 0));
      return;
    }
    if (attr('data-wb-cat') !== null) { setFilters({ cat: attr('data-wb-cat') }); return; }
    if (attr('data-wb-clear')) {
      write('wb_filters_v1', { cat: '', q: '', sort: 'featured', min: '', max: '' });
      emit();
      return;
    }
    if (attr('data-wb-coupon')) {
      var code = (document.querySelector('[data-wb-coupon-input]') || {}).value || '';
      var resolved = couponFor(String(code).trim(), totals(cart()).subtotal);
      if (!resolved) { toast('That coupon code is not valid.'); return; }
      if (!resolved.usable) { toast('Needs a subtotal of ' + money(resolved.coupon.min) + ' or more.'); return; }
      setCoupon(String(code).trim().toUpperCase());
      toast('Coupon applied');
      return;
    }
    if (attr('data-wb-coupon-clear')) { setCoupon(''); return; }
    if (attr('data-wb-place')) { placeOrder(el); return; }
    if (attr('data-wb-step')) {
      var bits = attr('data-wb-step').split('');
      var direction = bits[1] === '+' ? 1 : -1;
      var target = document.getElementById('wb-pq-' + bits.slice(2).join(''));
      if (target) target.textContent = String(Math.max(1, Math.min(20, (parseInt(target.textContent, 10) || 1) + direction)));
      return;
    }
    if (attr('data-wb-shop-toggle')) {
      var block = document.querySelector('[data-wb-shop="' + attr('data-wb-shop-toggle') + '"]');
      if (block) block.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el || !el.getAttribute) return;
    if (el.hasAttribute('data-wb-filter')) {
      var patch = {};
      patch[el.getAttribute('data-wb-filter')] = el.value;
      setFilters(patch);
      return;
    }
    if (el.name === 'shipping_method') { setShippingMethod(el.value); return; }
    if (el.hasAttribute('data-wb-payment') || el.name === 'cod_payer' || el.name === 'payment_method') {
      var form = el.closest ? el.closest('[data-wb-checkout]') : null;
      if (form) syncCodVisibility(form);
    }
  });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.getAttribute) return;
    if (form.hasAttribute('data-wb-checkout')) { e.preventDefault(); placeOrder(form.querySelector('[data-wb-place]')); return; }
    if (form.hasAttribute('data-wb-track')) { e.preventDefault(); trackOrder(form); return; }
    if (form.hasAttribute('data-wb-review')) {
      e.preventDefault();
      var data = new FormData(form);
      var p = productBySlug(params(form.closest('[data-wb-shop]') || form).product || qp('product'));
      var body = {
        action: 'addReview',
        product: p ? p.slug : '',
        name: data.get('name'),
        rating: Number(data.get('rating')) || 5,
        title: data.get('title'),
        body: data.get('body')
      };
      api(body).then(function (res) {
        if (res && res.ok) { form.reset(); toast('Thanks - your review is live.'); }
        else toast((res && res.error) || 'Could not save that review.');
      });
    }
  });

  /* --------------------------------------------------------------- boot */

  window.WBShop = {
    SEED: SEED,
    PRODUCTS: PRODUCTS,
    SELLERS: SELLERS,
    SETTINGS: SETTINGS,
    panels: {},
    api: api,
    totals: totals,
    money: money,
    esc: esc,
    cart: cart,
    setCart: setCart,
    addToCart: addToCart,
    totalsFor: totals,
    renderBlock: renderBlock,
    rerender: rerender,
    on: on,
    productBySku: productBySku,
    sellerById: sellerById,
    stars: stars,
    statusLabel: function (id) { return STATUS_LABEL[id] || id; },
    statusTimeline: statusTimeline,
    rowsHtml: function (o) { return o.items.map(function (i) { return i.name + ' \u00d7 ' + i.qty; }).join(', '); }
  };

  function boot() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-wb-shop]'), function (root) {
      if (root.getAttribute('data-wb-rendered') === '1' &&
        RENDERERS[root.getAttribute('data-wb-shop')]) {
        return; // server rendered, nothing to draw yet
      }
      renderBlock(root);
    });
    updateBadges();
    rerender();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* ---- Store panels ---- */
(function () {
  'use strict';

  function boot() {
    if (!window.WBShop) return;

    var esc = WBShop.esc;
    var money = WBShop.money;
    var api = WBShop.api;
    var SETTINGS = WBShop.SETTINGS;

    /* ------------------------------------------------------ shared bits */

    function block(root) { return root.closest('[data-wb-shop]') || root; }
    function gate(root, opts) {
      opts = opts || {};
      return api({ action: 'session' }).then(function (res) {
        var user = res && res.ok ? res.user : null;
        if (user && user.role === 'admin') return { user: user, seller: null };
        if (opts.sellerId && user && user.email) {
          var match = WBShop.SELLERS.filter(function (s) {
            return String(s.email).toLowerCase() === String(user.email).toLowerCase();
          })[0];
          if (match && (!opts.sellerId || opts.sellerId === 'any' || match.id === opts.sellerId)) {
            return { user: user, seller: match };
          }
        }
        return { user: null, seller: null };
      });
    }

    function loginBox(root, title, hint) {
      root.innerHTML = '<div class="wb-locked"><h3 style="margin:.2rem 0">' + esc(title) + '</h3>' +
        '<p class="wb-form__note" style="margin-bottom:.8rem">' + esc(hint) + '</p>' +
        '<form class="wb-form" data-wb-login>' +
        '<div class="wb-form__row"><label>Email</label><input name="login" type="email" autocomplete="username"></div>' +
        '<div class="wb-form__row"><label>Password</label><input name="password" type="password" autocomplete="current-password"></div>' +
        '<div class="wb-form__err" data-err></div>' +
        '<button class="wb-btn wb-btn--primary wb-btn--block">Sign in</button></form>' +
        '<p class="wb-form__note" style="margin-top:.6rem">Sign in with the account that owns this panel.</p></div>';
    }

    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || !form.hasAttribute || !form.hasAttribute('data-wb-login')) return;
      e.preventDefault();
      var login = form.login.value.trim();
      var password = form.password.value;
      var err = form.querySelector('[data-err]');
      if (err) err.textContent = '';
      api({ action: 'login', login: login, password: password }).then(function (res) {
        if (res && res.ok) { WBShop.rerender(); return; }
        if (err) err.textContent = (res && res.error) || 'Sign in failed.';
      })['catch'](function () {
        if (err) err.textContent = 'Sign in failed.';
      });
    });

    function tabBar(tabs, active) {
      return '<div class="wb-tabs wb-noprint">' + tabs.map(function (t) {
        return '<button data-wb-tab="' + esc(t.id) + '" class="' + (t.id === active ? 'is-active' : '') + '">' +
          esc(t.label) + '</button>';
      }).join('') + '</div>';
    }

    function kpi(label, value) {
      return '<div class="wb-kpi"><span>' + esc(label) + '</span><b>' + esc(String(value)) + '</b></div>';
    }

    function statusPill(status) {
      var row = (WBShop.SEED.statuses || []).filter(function (s) { return s.id === status; })[0];
      return '<span class="wb-pill" style="background:' + ((row && row.color) || '#64748b') + '">' +
        esc(WBShop.statusLabel(status)) + '</span>';
    }

    function downloadCsv(filename, rows) {
      var blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    function escCsv(value) {
      var s = String(value == null ? '' : value);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

    /* ------------------------------------------------------- admin panel */

    function adminDashboard(data) {
      var k = data.kpis || {};
      var days = data.daily || [];
      var max = days.reduce(function (a, d) { return Math.max(a, d.revenue); }, 1);
      return '<div class="wb-kpis">' +
        kpi('Revenue', money(k.revenue)) +
        kpi('Orders', k.orders) +
        kpi('Avg order', money(k.aov)) +
        kpi('Pending', k.pending) +
        kpi('Delivered', k.delivered) +
        kpi('COD outstanding', money(k.codOutstanding)) +
        kpi('Low stock', k.lowStock) +
        kpi('Refunded', money(k.refunded)) +
        '</div>' +
        '<div class="wb-two">' +
        '<div class="wb-panel"><h3 class="wb-panel__title">Revenue, last ' + days.length + ' days</h3>' +
        '<div class="wb-bars">' + days.map(function (d) {
          var h = Math.max(2, Math.round((d.revenue / max) * 78));
          return '<div class="' + (d.revenue === max ? 'is-top' : '') + '" style="height:' + h + 'px" title="' +
            esc(d.day) + ': ' + money(d.revenue) + '"></div>';
        }).join('') + '</div></div>' +
        '<div class="wb-panel"><h3 class="wb-panel__title">Top products</h3>' +
        '<div class="wb-table-wrap"><table class="wb-table"><tr><th>Product</th><th>Sold</th><th>Revenue</th></tr>' +
        (data.top || []).map(function (p) {
          return '<tr><td>' + esc(p.name) + '</td><td>' + p.qty + '</td><td>' + money(p.revenue) + '</td></tr>';
        }).join('') + '</table></div></div></div>' +
        '<div class="wb-panel"><h3 class="wb-panel__title">Recent orders</h3>' +
        ordersTable((data.recent || []).slice(0, 8), false) + '</div>';
    }

    function ordersTable(orders, withActions) {
      if (!orders.length) return '<div class="wb-shop__empty">No orders yet.</div>';
      return '<div class="wb-table-wrap"><table class="wb-table"><tr>' +
        '<th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th>' +
        '<th>COD</th><th>Status</th>' + (withActions ? '<th></th>' : '') + '</tr>' +
        orders.map(function (o) {
          return '<tr><td><strong>' + esc(o.order_no) + '</strong></td>' +
            '<td>' + esc(String(o.created_at || '').slice(0, 10)) + '</td>' +
            '<td>' + esc(o.customer_name || (o.customer && o.customer.name) || o.email || '') + '</td>' +
            '<td>' + (o.items || []).length + '</td>' +
            '<td><strong>' + money(o.total) + '</strong></td>' +
            '<td>' + esc(String(o.payment_method || '').toUpperCase()) + '</td>' +
            '<td>' + (o.payment_method === 'cod'
              ? esc(String(o.cod_amount || 0)) + ' <small>' + esc(o.cod_status || 'pending') + '</small>'
              : '\u2014') + '</td>' +
            '<td>' + statusPill(o.status) + '</td>' +
            (withActions ? '<td><button class="wb-btn wb-btn--sm" data-wb-order="' + esc(o.order_no) + '">Open</button></td>' : '') +
            '</tr>';
        }).join('') + '</table></div>';
    }

    function orderDrawer(order) {
      var next = (WBShop.SEED.statuses || []).filter(function (s) { return s.id === order.status; })[0];
      var buttons = next ? next.next.map(function (id) {
        return '<button class="wb-btn wb-btn--sm" data-wb-set-status="' + esc(order.order_no) + '|' + esc(id) + '">' +
          esc(WBShop.statusLabel(id)) + '</button>';
      }).join(' ') : '<span class="wb-form__note">This order has reached a final state.</span>';

      var codBox = order.payment_method === 'cod'
        ? '<div class="wb-cod" style="margin:.7rem 0"><p class="wb-cod__title">Cash on delivery</p>' +
          '<div class="wb-cod__amount">' + money(order.cod_amount) + '</div>' +
          '<p class="wb-cod__hint">' + esc(order.cod_instructions || SETTINGS.codNote || '') + '</p>' +
          '<p class="wb-cod__hint">Status: <strong>' + esc(order.cod_status || 'pending') + '</strong>' +
          (order.cod_payer ? ' &middot; paid by ' + esc(order.cod_payer) : '') +
          (order.cod_receiver_name ? ' &middot; receiver ' + esc(order.cod_receiver_name) : '') + '</p>' +
          '<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.5rem">' +
          ['collected', 'failed', 'waived', 'in_transit'].map(function (cs) {
            return '<button class="wb-btn wb-btn--sm" data-wb-set-cod="' + esc(order.order_no) + '|' + cs + '">' +
              esc(cs.replace(/_/g, ' ')) + '</button>';
          }).join('') + '</div></div>'
        : '';

      return '<div class="wb-drawer" data-wb-drawer><div class="wb-drawer__body">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<h3 style="margin:0">Order ' + esc(order.order_no) + '</h3>' +
        '<button class="wb-btn wb-btn--sm" data-wb-close-drawer>Close</button></div>' +
        '<div class="wb-form__grid" style="margin:.7rem 0">' +
        kpi('Total', money(order.total)) +
        kpi('Status', WBShop.statusLabel(order.status)) +
        kpi('Payment', String(order.payment_method || '').toUpperCase()) +
        kpi('Placed', String(order.created_at || '').slice(0, 10)) +
        '</div>' +
        '<div class="wb-panel"><h3 class="wb-panel__title">Customer</h3>' +
        '<p style="font-size:.82rem;margin:0">' + esc(order.customer_name || (order.customer && order.customer.name) || '') +
        '<br>' + esc(order.email || '') + '<br>' + esc(order.phone || '') + '</p>' +
        '<p style="font-size:.8rem;color:#475569">' +
        esc([order.line1, order.line2, order.city, order.state, order.postal_code, order.country]
          .filter(Boolean).join(', ')) + '</p>' +
        '<p style="font-size:.8rem;color:#475569">Delivery: ' +
        esc(WBShop.SEED.shipping.filter(function (s) { return s.id === order.shipping_method; })[0] ?
          WBShop.SEED.shipping.filter(function (s) { return s.id === order.shipping_method; })[0].label :
          String(order.shipping_method || '')) +
        (order.delivery_date ? ' on ' + esc(order.delivery_date) : '') +
        (order.delivery_window && order.delivery_window !== 'Any time' ? ' (' + esc(order.delivery_window) + ')' : '') +
        '</p>' +
        (order.delivery_notes ? '<p class="wb-form__note">Note: ' + esc(order.delivery_notes) + '</p>' : '') +
        '</div>' +
        codBox +
        '<div class="wb-panel"><h3 class="wb-panel__title">Items</h3>' +
        '<div class="wb-table-wrap"><table class="wb-table"><tr><th>SKU</th><th>Product</th><th>Qty</th><th>Price</th></tr>' +
        (order.items || []).map(function (i) {
          return '<tr><td>' + esc(i.sku) + '</td><td>' + esc(i.name) + '</td><td>' + i.qty + '</td><td>' +
            money(i.price) + '</td></tr>';
        }).join('') + '</table></div>' +
        '<div class="wb-totals">' +
        '<div><span>Subtotal</span><span>' + money(order.subtotal) + '</span></div>' +
        (Number(order.discount) > 0 ? '<div><span>Discount</span><span>-' + money(order.discount) + '</span></div>' : '') +
        '<div><span>Shipping</span><span>' + money(order.shipping_fee) + '</span></div>' +
        (Number(order.cod_fee) > 0 ? '<div><span>COD fee</span><span>' + money(order.cod_fee) + '</span></div>' : '') +
        '<div><span>Tax</span><span>' + money(order.tax) + '</span></div>' +
        '<div class="is-total"><span>Total</span><span>' + money(order.total) + '</span></div></div></div>' +
        '<div class="wb-panel"><h3 class="wb-panel__title">Move this order on</h3>' +
        '<div style="display:flex;gap:.3rem;flex-wrap:wrap">' + buttons + '</div></div>' +
        '<div class="wb-form__row"><label>Internal note</label>' +
        '<textarea name="seller_notes" rows="2">' + esc(order.seller_notes || '') + '</textarea></div>' +
        '<button class="wb-btn wb-btn--primary" data-wb-save-note="' + esc(order.order_no) + '">Save note</button>' +
        '</div></div>';
    }

    function adminOrders(data) {
      var orders = data.orders || [];
      var f = (root) => root.__wbFilter || 'all';
      var shown = orders.filter(function (o) {
        var want = f(block(root));
        return want === 'all' || o.status === want;
      });
      var counts = {};
      orders.forEach(function (o) { counts[o.status] = (counts[o.status] || 0) + 1; });
      return '<div class="wb-panel"><div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center">' +
        '<select data-wb-order-filter class="wb-btn"><option value="all">All statuses (' + orders.length + ')</option>' +
        (WBShop.SEED.statuses || []).map(function (s) {
          return '<option value="' + esc(s.id) + '">' + esc(s.label) + ' (' + (counts[s.id] || 0) + ')</option>';
        }).join('') + '</select>' +
        '<span class="wb-form__note">COD: ' + orders.filter(function (o) { return o.payment_method === 'cod'; }).length +
        ' orders, ' + money(orders.reduce(function (a, o) {
          return a + (o.payment_method === 'cod' && o.cod_status !== 'collected' ? Number(o.cod_amount || 0) : 0);
        }, 0)) + ' still to collect.</span></div></div>' +
        '<div data-wb-order-table>' + ordersTable(shown, true) + '</div>';
    }

    function adminProducts(data) {
      var products = data.products || [];
      var rows = products.map(function (p) {
        return '<tr data-sku="' + esc(p.sku) + '"><td>' + esc(p.sku) + '</td>' +
          '<td><strong>' + esc(p.name) + '</strong><br><small>' + esc(p.category) + '</small></td>' +
          '<td>' + esc(p.seller) + '</td>' +
          '<td>' + money(p.price) + (p.compareAt && p.compareAt > p.price ? ' <s><small>' + money(p.compareAt) + '</small></s>' : '') + '</td>' +
          '<td>' + p.stock + '</td>' +
          '<td>' + (p.active ? 'Yes' : '<span style="color:#dc2626">No</span>') + '</td>' +
          '<td><button class="wb-btn wb-btn--sm" data-wb-edit-product="' + esc(p.sku) + '">Edit</button> ' +
          '<button class="wb-btn wb-btn--sm wb-btn--danger" data-wb-del-product="' + esc(p.sku) + '">Delete</button></td></tr>';
      }).join('');
      return '<div class="wb-panel"><h3 class="wb-panel__title">Products (' + products.length + ')' +
        '<button class="wb-btn wb-btn--primary wb-btn--sm" data-wb-new-product>New product</button></h3>' +
        '<div class="wb-table-wrap"><table class="wb-table"><tr><th>SKU</th><th>Name</th><th>Seller</th>' +
        '<th>Price</th><th>Stock</th><th>Active</th><th></th></tr>' + rows + '</table></div></div>' +
        '<div data-wb-product-form></div>';
    }

    function productForm(product, categories, sellers) {
      var p = product || { sku: '', name: '', price: 0, compareAt: 0, stock: 0, category: '', seller: '', badge: '', blurb: '', active: true, tint: '#eef2ff', emoji: '📦' };
      return '<div class="wb-panel" data-wb-product-editor>' +
        '<h3 class="wb-panel__title">' + (product ? 'Edit ' + esc(p.sku) : 'New product') + '</h3>' +
        '<form class="wb-form" data-wb-product-save>' +
        '<input type="hidden" name="original_sku" value="' + esc(product ? p.sku : '') + '">' +
        '<div class="wb-form__grid">' +
        wbRow('SKU', '<input name="sku" value="' + esc(p.sku) + '" required>') +
        wbRow('Name', '<input name="name" value="' + esc(p.name) + '" required>') +
        wbRow('Price', '<input name="price" type="number" step="0.01" min="0" value="' + esc(p.price) + '" required>') +
        wbRow('Compare at', '<input name="compareAt" type="number" step="0.01" min="0" value="' + esc(p.compareAt || 0) + '">') +
        wbRow('Stock', '<input name="stock" type="number" min="0" value="' + esc(p.stock) + '">') +
        wbRow('Category', '<select name="category">' + categories.map(function (c) {
          return '<option value="' + esc(c.slug) + '"' + (p.category === c.slug ? ' selected' : '') + '>' + esc(c.name) + '</option>';
        }).join('') + '</select>') +
        wbRow('Seller', '<select name="seller">' + sellers.map(function (s) {
          return '<option value="' + esc(s.id) + '"' + (p.seller === s.id ? ' selected' : '') + '>' + esc(s.store) + '</option>';
        }).join('') + '</select>') +
        wbRow('Badge', '<input name="badge" value="' + esc(p.badge || '') + '" placeholder="Sale, New, Best seller">') +
        '</div>' +
        wbRow('Short description', '<textarea name="blurb" rows="2">' + esc(p.blurb) + '</textarea>') +
        '<div class="wb-form__grid">' +
        wbRow('Emoji', '<input name="emoji" value="' + esc(p.emoji) + '">') +
        wbRow('Tile colour', '<input name="tint" value="' + esc(p.tint) + '">') +
        wbRow('Active', '<select name="active"><option value="1"' + (p.active ? ' selected' : '') + '>Yes</option>' +
          '<option value="0"' + (!p.active ? ' selected' : '') + '>No</option></select>') +
        '</div><button class="wb-btn wb-btn--primary">Save product</button></form></div>';
    }

    function wbRow(label, inner) {
      return '<div class="wb-form__row"><label>' + esc(label) + '</label>' + inner + '</div>';
    }

    function adminSellers(data) {
      return '<div class="wb-panel"><h3 class="wb-panel__title">Sellers (' + (data.sellers || []).length + ')</h3>' +
        '<div class="wb-table-wrap"><table class="wb-table"><tr><th>Store</th><th>Contact</th><th>Commission</th>' +
        '<th>Rating</th><th>Products</th><th>Revenue</th><th>Status</th></tr>' +
        (data.sellers || []).map(function (s) {
          return '<tr><td><strong>' + esc(s.store) + '</strong><br><small>' + esc(s.name) + '</small></td>' +
            '<td>' + esc(s.email) + '<br>' + esc(s.phone) + '</td>' +
            '<td>' + s.commission + '%</td><td>' + s.rating + '</td>' +
            '<td>' + (s.product_count || 0) + '</td><td>' + money(s.revenue || 0) + '</td>' +
            '<td><select data-wb-seller-status="' + esc(s.id) + '">' +
            ['active', 'pending', 'suspended'].map(function (st) {
              return '<option value="' + st + '"' + (s.status === st ? ' selected' : '') + '>' + st + '</option>';
            }).join('') + '</select></td></tr>';
        }).join('') + '</table></div></div>';
    }

    function adminCoupons(data) {
      return '<div class="wb-panel"><h3 class="wb-panel__title">Coupons</h3>' +
        '<div class="wb-table-wrap"><table class="wb-table"><tr><th>Code</th><th>Type</th><th>Value</th>' +
        '<th>Min order</th><th>Used</th><th>Note</th></tr>' +
        (data.coupons || []).map(function (c) {
          return '<tr><td><strong>' + esc(c.code) + '</strong></td><td>' + esc(c.type) + '</td>' +
            '<td>' + (c.type === 'percent' ? c.value + '%' : money(c.value)) + '</td>' +
            '<td>' + (Number(c.min) ? money(c.min) : '\u2014') + '</td>' +
            '<td>' + (c.used || 0) + (c.max_uses ? ' / ' + c.max_uses : '') + '</td>' +
            '<td>' + esc(c.note || '') + '</td></tr>';
        }).join('') + '</table></div>' +
        '<form class="wb-form" data-wb-coupon-save style="margin-top:.8rem">' +
        '<div class="wb-form__grid">' +
        wbRow('Code', '<input name="code" required placeholder="SPRING20">') +
        wbRow('Type', '<select name="type"><option value="percent">Percent off</option>' +
          '<option value="fixed">Fixed amount off</option><option value="shipping">Free shipping</option></select>') +
        wbRow('Value', '<input name="value" type="number" step="0.01" min="0" value="10">') +
        wbRow('Minimum order', '<input name="min" type="number" step="0.01" min="0" value="0">') +
        wbRow('Note', '<input name="note" placeholder="Shown to the customer">') +
        '</div><button class="wb-btn wb-btn--primary">Create coupon</button></form></div>';
    }

    function adminCustomers(data) {
      return '<div class="wb-panel"><h3 class="wb-panel__title">Customers (' + (data.customers || []).length + ')</h3>' +
        '<div class="wb-table-wrap"><table class="wb-table"><tr><th>Name</th><th>Email</th><th>Phone</th>' +
        '<th>City</th><th>Orders</th><th>Spent</th></tr>' +
        (data.customers || []).map(function (c) {
          return '<tr><td>' + esc(c.name) + '</td><td>' + esc(c.email) + '</td><td>' + esc(c.phone || '') + '</td>' +
            '<td>' + esc(c.city || '') + '</td><td>' + c.orders + '</td><td>' + money(c.spent) + '</td></tr>';
        }).join('') + '</table></div></div>';
    }

    function adminSettings(data) {
      var s = data.settings || {};
      return '<form class="wb-form" data-wb-settings>' +
        '<div class="wb-panel"><h3 class="wb-panel__title">Store</h3><div class="wb-form__grid">' +
        wbRow('Store name', '<input name="storeName" value="' + esc(s.storeName || '') + '">') +
        wbRow('Tagline', '<input name="tagline" value="' + esc(s.tagline || '') + '">') +
        wbRow('Currency symbol', '<input name="currency" value="' + esc(s.currency || '$') + '">') +
        wbRow('Currency code', '<input name="currencyCode" value="' + esc(s.currencyCode || 'USD') + '">') +
        wbRow('Tax rate (%)', '<input name="taxRate" type="number" step="0.1" min="0" value="' + esc(s.taxRate || 0) + '">') +
        wbRow('Free shipping over', '<input name="freeShippingOver" type="number" step="0.01" min="0" value="' + esc(s.freeShippingOver || 0) + '">') +
        wbRow('Low stock alert at', '<input name="lowStockAt" type="number" min="0" value="' + esc(s.lowStockAt || 10) + '">') +
        '</div></div>' +
        '<div class="wb-panel"><h3 class="wb-panel__title">Cash on delivery</h3><div class="wb-form__grid">' +
        wbRow('COD enabled', '<select name="codEnabled"><option value="1"' + (s.codEnabled !== false ? ' selected' : '') + '>Yes</option>' +
          '<option value="0"' + (s.codEnabled === false ? ' selected' : '') + '>No</option></select>') +
        wbRow('COD handling fee', '<input name="codFee" type="number" step="0.01" min="0" value="' + esc(s.codFee || 0) + '">') +
        '</div>' + wbRow('Note for customers', '<textarea name="codNote" rows="2">' + esc(s.codNote || '') + '</textarea>') +
        '</div><button class="wb-btn wb-btn--primary">Save settings</button></form>';
    }

    var ADMIN_TABS = [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'orders', label: 'Orders' },
      { id: 'products', label: 'Products' },
      { id: 'sellers', label: 'Sellers' },
      { id: 'coupons', label: 'Coupons' },
      { id: 'customers', label: 'Customers' },
      { id: 'settings', label: 'Settings' }
    ];

    function renderAdmin(root) {
      var b = block(root);
      b.__tab = b.__tab || 'dashboard';
      gate(b, { sellerId: 'any' }).then(function (session) {
        if (!session.user || session.user.role !== 'admin') {
          loginBox(root, 'Admin panel', 'Only the store owner can open this panel.');
          return;
        }
        return api({ action: 'adminOverview' }).then(function (res) {
          if (!res || !res.ok) {
            root.innerHTML = '<div class="wb-alert wb-alert--error">' + esc((res && res.error) || 'Could not load the panel.') + '</div>';
            return;
          }
          var data = res.data || {};
          var html = '<div class="wb-panel"><h3 class="wb-panel__title">Store administration ' +
            '<small class="wb-form__note">' + esc(data.settings.storeName || '') + '</small></h3>' +
            '<button class="wb-btn wb-btn--sm wb-noprint" data-wb-csv>Export orders CSV</button></div>' +
            tabBar(ADMIN_TABS, b.__tab);
          if (b.__tab === 'dashboard') html += adminDashboard(data);
          else if (b.__tab === 'orders') html += adminOrders(data);
          else if (b.__tab === 'products') html += adminProducts(data);
          else if (b.__tab === 'sellers') html += adminSellers(data);
          else if (b.__tab === 'coupons') html += adminCoupons(data);
          else if (b.__tab === 'customers') html += adminCustomers(data);
          else if (b.__tab === 'settings') html += adminSettings(data);
          root.innerHTML = html;
          b.__data = data;
          if (b.__editSku) {
            var slot = root.querySelector('[data-wb-product-form]');
            var found = (data.products || []).filter(function (p) { return p.sku === b.__editSku; })[0];
            if (slot) slot.innerHTML = productForm(found, data.categories || [], data.sellers || []);
          }
        });
      });
    }

    /* ------------------------------------------------------ seller panel */

    function sellerOverview(data) {
      var k = data.kpis || {};
      return '<div class="wb-kpis">' +
        kpi('Your revenue', money(k.revenue)) +
        kpi('Orders', k.orders) +
        kpi('Items sold', k.items) +
        kpi('Commission', money(k.commission)) +
        kpi('Payout due', money(k.payoutDue)) +
        kpi('Pending', k.pending) +
        '</div>' +
        '<div class="wb-two">' +
        '<div class="wb-panel"><h3 class="wb-panel__title">Your products</h3>' +
        '<div class="wb-table-wrap"><table class="wb-table"><tr><th>SKU</th><th>Product</th><th>Price</th>' +
        '<th>Stock</th><th>Sold</th><th>Revenue</th><th></th></tr>' +
        (data.products || []).map(function (p) {
          return '<tr><td>' + esc(p.sku) + '</td><td>' + esc(p.name) + '</td><td>' + money(p.price) + '</td>' +
            '<td>' + p.stock + '</td><td>' + (p.sold || 0) + '</td><td>' + money(p.revenue || 0) + '</td>' +
            '<td><button class="wb-btn wb-btn--sm" data-wb-edit-product="' + esc(p.sku) + '">Edit</button></td></tr>';
        }).join('') + '</table></div>' +
        '<button class="wb-btn wb-btn--primary wb-btn--sm" data-wb-new-product>Add a product</button></div>' +
        '<div class="wb-panel"><h3 class="wb-panel__title">Order lines for your products</h3>' +
        (data.lines || []).length
          ? '<div class="wb-table-wrap"><table class="wb-table"><tr><th>Order</th><th>Product</th><th>Qty</th>' +
            '<th>Status</th><th>Payout</th><th></th></tr>' + data.lines.map(function (l) {
              return '<tr><td><strong>' + esc(l.order_no) + '</strong><br><small>' + esc(String(l.created_at || '').slice(0, 10)) +
                '</small></td><td>' + esc(l.name) + '</td><td>' + l.qty + '</td>' +
                '<td>' + statusPill(l.status) + '</td><td>' + money(l.payout) + '</td>' +
                '<td><button class="wb-btn wb-btn--sm" data-wb-order="' + esc(l.order_no) + '">Open</button></td></tr>';
            }).join('') + '</table></div>'
          : '<div class="wb-shop__empty">No orders for your products yet.</div>' +
        '</div></div>';
    }

    function sellerProfile(data) {
      var s = data.seller || {};
      return '<form class="wb-form" data-wb-seller-profile>' +
        '<div class="wb-panel"><h3 class="wb-panel__title">' + esc(s.store || '') + '</h3>' +
        '<div class="wb-form__grid">' +
        wbRow('Store name', '<input name="store" value="' + esc(s.store || '') + '">') +
        wbRow('Contact name', '<input name="name" value="' + esc(s.name || '') + '">') +
        wbRow('Email', '<input name="email" type="email" value="' + esc(s.email || '') + '">') +
        wbRow('Phone', '<input name="phone" value="' + esc(s.phone || '') + '">') +
        '</div><button class="wb-btn wb-btn--primary">Save profile</button></div></form>';
    }

    var SELLER_TABS = [
      { id: 'overview', label: 'Overview' },
      { id: 'products', label: 'Products' },
      { id: 'orders', label: 'Orders' },
      { id: 'payouts', label: 'Payouts' },
      { id: 'profile', label: 'Store profile' }
    ];

    function renderSeller(root) {
      var b = block(root);
      b.__tab = b.__tab || 'overview';
      var wanted = (String(new RegExp('[?&]seller=([^&#]*)').exec(window.location.search) || [])[1]) || 'any';
      gate(b, { sellerId: wanted }).then(function (session) {
        if (!session.user || !session.seller) {
          loginBox(root, 'Seller panel', 'Sign in with the seller account to manage your products and orders.');
          return;
        }
        return api({ action: 'sellerOverview', seller_id: session.seller.id }).then(function (res) {
          if (!res || !res.ok) {
            root.innerHTML = '<div class="wb-alert wb-alert--error">' + esc((res && res.error) || 'Could not load the panel.') + '</div>';
            return;
          }
          var data = res.data || {};
          var html = '<div class="wb-panel"><h3 class="wb-panel__title">' + esc(data.seller.store) +
            ' <small class="wb-form__note">commission ' + data.seller.commission + '%</small></h3></div>' +
            tabBar(SELLER_TABS, b.__tab);
          if (b.__tab === 'overview') html += sellerOverview(data);
          else if (b.__tab === 'products') html += adminProducts(data);
          else if (b.__tab === 'orders') html += ordersTable(data.orders || [], true);
          else if (b.__tab === 'payouts') {
            html += '<div class="wb-panel"><h3 class="wb-panel__title">Payouts</h3>' +
              '<div class="wb-table-wrap"><table class="wb-table"><tr><th>Order</th><th>Lines</th><th>Gross</th>' +
              '<th>Commission</th><th>Net payout</th><th>Status</th></tr>' +
              (data.payouts || []).map(function (p) {
                return '<tr><td>' + esc(p.order_no) + '</td><td>' + p.lines + '</td><td>' + money(p.gross) + '</td>' +
                  '<td>-' + money(p.commission) + '</td><td><strong>' + money(p.net) + '</strong></td>' +
                  '<td>' + statusPill(p.status) + '</td></tr>';
              }).join('') + '</table></div></div>';
          } else if (b.__tab === 'profile') html += sellerProfile(data);
          root.innerHTML = html;
          b.__data = data;
          if (b.__editSku) {
            var slot = root.querySelector('[data-wb-product-form]');
            var found = (data.products || []).filter(function (p) { return p.sku === b.__editSku; })[0];
            if (slot) slot.innerHTML = productForm(found, data.categories || [], [data.seller]);
          }
        });
      });
    }

    /* ------------------------------------------------------- interactions */

    function currentBlock(el) { return el ? el.closest('[data-wb-shop]') : null; }

    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-wb-tab],[data-wb-order],' +
        '[data-wb-set-status],[data-wb-set-cod],[data-wb-edit-product],[data-wb-new-product],' +
        '[data-wb-del-product],[data-wb-csv],[data-wb-close-drawer],[data-wb-save-note]') : null;
      if (!el) return;
      var b = currentBlock(el);
      if (!b) return;
      var attr = function (n) { return el.getAttribute(n); };

      if (attr('data-wb-tab')) { b.__tab = attr('data-wb-tab'); WBShop.rerender(); return; }

      if (attr('data-wb-edit-product')) { b.__editSku = attr('data-wb-edit-product'); WBShop.rerender(); return; }
      if (attr('data-wb-new-product')) { b.__editSku = null; b.__tab = b.__tab || 'products'; WBShop.rerender(); return; }
      if (attr('data-wb-close-drawer')) {
        var drawer = document.querySelector('[data-wb-drawer]');
        if (drawer) drawer.remove();
        return;
      }
      if (attr('data-wb-csv')) {
        var orders = (b.__data && b.__data.orders) || (b.__data && b.__data.recent) || [];
        var head = ['order_no', 'created_at', 'customer_name', 'email', 'phone', 'city', 'country',
          'payment_method', 'cod_amount', 'cod_status', 'subtotal', 'shipping_fee', 'cod_fee', 'tax', 'total', 'status'];
        var rows = [head.join(',')].concat(orders.map(function (o) {
          return head.map(function (k) { return escCsv(o[k]); }).join(',');
        }));
        downloadCsv('orders.csv', rows);
        return;
      }
      if (attr('data-wb-del-product')) {
        var sku = attr('data-wb-del-product');
        if (!window.confirm('Delete ' + sku + '? This cannot be undone.')) return;
        api({ action: 'deleteProduct', sku: sku }).then(function (res) {
          if (res && res.ok) { WBShop.rerender(); return; }
          window.alert((res && res.error) || 'Could not delete that product.');
        });
        return;
      }

      var payload = null;
      if (attr('data-wb-set-status')) {
        var parts = attr('data-wb-set-status').split('|');
        payload = { action: 'setOrderStatus', order_no: parts[0], status: parts[1] };
      } else if (attr('data-wb-set-cod')) {
        var codParts = attr('data-wb-set-cod').split('|');
        payload = { action: 'setOrderCod', order_no: codParts[0], cod_status: codParts[1] };
      } else if (attr('data-wb-order')) {
        var no = attr('data-wb-order');
        return api({ action: 'listOrders' }).then(function (res) {
          var found = (res && res.orders ? res.orders : []).filter(function (o) { return o.order_no === no; })[0];
          if (found) {
            var host = document.createElement('div');
            host.innerHTML = orderDrawer(found);
            document.body.appendChild(host.firstChild);
          }
        });
      } else if (attr('data-wb-save-note')) {
        var noteEl = document.querySelector('[data-wb-drawer] textarea[name=seller_notes]');
        payload = { action: 'saveOrderNote', order_no: attr('data-wb-save-note'), note: noteEl ? noteEl.value : '' };
      }
      if (!payload) return;
      api(payload).then(function (res) {
        if (res && res.ok) {
          var drawer = document.querySelector('[data-wb-drawer]');
          if (drawer) drawer.remove();
          WBShop.rerender();
        } else {
          window.alert((res && res.error) || 'That change was rejected.');
        }
      });
    });

    document.addEventListener('change', function (e) {
      var el = e.target;
      if (!el || !el.getAttribute) return;
      if (el.hasAttribute && el.hasAttribute('data-wb-order-filter')) {
        var b = currentBlock(el);
        if (b) { b.__filter = el.value; WBShop.rerender(); }
        return;
      }
      if (el.hasAttribute && el.hasAttribute('data-wb-seller-status')) {
        api({ action: 'setSellerStatus', seller_id: el.getAttribute('data-wb-seller-status'), status: el.value })
          .then(function (res) { WBShop.rerender(); });
      }
    });

    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || !form.hasAttribute) return;
      var data = new FormData(form);

      if (form.hasAttribute('data-wb-product-save')) {
        e.preventDefault();
        var payload = {
          action: 'saveProduct',
          original_sku: data.get('original_sku') || '',
          product: {
            sku: String(data.get('sku') || '').trim(),
            name: String(data.get('name') || '').trim(),
            price: Number(data.get('price')) || 0,
            compareAt: Number(data.get('compareAt')) || 0,
            stock: Number(data.get('stock')) || 0,
            category: String(data.get('category') || ''),
            seller: String(data.get('seller') || ''),
            badge: String(data.get('badge') || ''),
            blurb: String(data.get('blurb') || ''),
            emoji: String(data.get('emoji') || '📦'),
            tint: String(data.get('tint') || '#eef2ff'),
            active: String(data.get('active')) === '1'
          }
        };
        api(payload).then(function (res) {
          if (res && res.ok) { form.closest('[data-wb-shop]').__editSku = null; WBShop.rerender(); return; }
          window.alert((res && res.error) || 'Could not save that product.');
        });
        return;
      }
      if (form.hasAttribute('data-wb-coupon-save')) {
        e.preventDefault();
        api({
          action: 'saveCoupon',
          coupon: {
            code: String(data.get('code') || '').trim().toUpperCase(),
            type: data.get('type'),
            value: Number(data.get('value')) || 0,
            min: Number(data.get('min')) || 0,
            note: String(data.get('note') || '')
          }
        }).then(function (res) {
          if (res && res.ok) { form.reset(); WBShop.rerender(); return; }
          window.alert((res && res.error) || 'Could not create that coupon.');
        });
        return;
      }
      if (form.hasAttribute('data-wb-settings')) {
        e.preventDefault();
        api({
          action: 'saveSettings',
          settings: {
            storeName: data.get('storeName'),
            tagline: data.get('tagline'),
            currency: data.get('currency'),
            currencyCode: data.get('currencyCode'),
            taxRate: Number(data.get('taxRate')) || 0,
            freeShippingOver: Number(data.get('freeShippingOver')) || 0,
            lowStockAt: Number(data.get('lowStockAt')) || 10,
            codEnabled: String(data.get('codEnabled')) === '1',
            codFee: Number(data.get('codFee')) || 0,
            codNote: data.get('codNote')
          }
        }).then(function (res) {
          window.alert(res && res.ok ? 'Settings saved.' : ((res && res.error) || 'Could not save settings.'));
          WBShop.rerender();
        });
        return;
      }
      if (form.hasAttribute('data-wb-seller-profile')) {
        e.preventDefault();
        api({
          action: 'saveSeller',
          seller: {
            store: data.get('store'), name: data.get('name'),
            email: data.get('email'), phone: data.get('phone')
          }
        }).then(function (res) {
          window.alert(res && res.ok ? 'Profile saved.' : ((res && res.error) || 'Could not save the profile.'));
          WBShop.rerender();
        });
      }
    });

    WBShop.panels.admin = renderAdmin;
    WBShop.panels.seller = renderSeller;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
