/**
 * Storefront runtime for generated sites.
 *
 * Same rule as the auth/search runtimes: one implementation that the PHP
 * export, the Node export, the WordPress export and the builder preview all
 * load, so a cart built in the preview behaves exactly like the deployed store.
 *
 * Server-rendered blocks arrive with `data-wb-rendered="1"` and are only
 * re-rendered on interaction; blocks that were never rendered (preview, static
 * export) are drawn here from `window.__WB_SHOP__`.
 *
 * Interaction is fully delegated from `document`, so re-rendering a block never
 * has to re-bind listeners.
 */

export const COMMERCE_CLIENT_CORE = `
(function () {
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
    return (SETTINGS.currency || '$') + parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',') + '.' + parts[1];
  }
  function qp(name) {
    var out = {};
    (String(window.location.search || '').charAt(0) === '?' ? window.location.search.slice(1) : '')
      .split('&').forEach(function (pair) {
        if (!pair) return;
        var idx = pair.indexOf('=');
        var key = decodeURIComponent((idx === -1 ? pair : pair.slice(0, idx)).replace(/\\+/g, ' '));
        out[key] = idx === -1 ? '' : decodeURIComponent(pair.slice(idx + 1).replace(/\\+/g, ' '));
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
    for (var i = 1; i <= 5; i++) out += i <= full ? '\\u2605' : '\\u2606';
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
      (wishlist().indexOf(p.sku) === -1 ? '\\u2661' : '\\u2665') + '</button>' +
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
      '<div class="wb-shop__field"><label for="wb-q">\\u2315</label>' +
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
      '<label for="wb-max">\\u2013</label>' +
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
      '<div class="wb-qty"><button data-wb-step="p-' + esc(p.sku) + '">\\u2212</button>' +
      '<span id="wb-pq-' + esc(p.sku) + '">1</span>' +
      '<button data-wb-step="p+' + esc(p.sku) + '">+</button></div>' +
      '<button class="wb-btn wb-btn--primary" data-wb-add="' + esc(p.sku) + '" data-wb-qty-from="wb-pq-' + esc(p.sku) + '">Add to cart</button>' +
      '<button class="wb-btn wb-btn--ghost" data-wb-wish="' + esc(p.sku) + '">' +
      (wishlist().indexOf(p.sku) === -1 ? 'Save for later' : 'Saved') + '</button>' +
      (SETTINGS.codEnabled === false ? '' :
        '<button class="wb-btn wb-btn--ghost" data-wb-addnow="' + esc(p.sku) + '" data-wb-qty-from="wb-pq-' + esc(p.sku) + '">Buy now</button>') +
      '</div>' +
      (SETTINGS.codEnabled === false ? '' :
        '<div class="wb-cod" style="margin-bottom:.8rem"><p class="wb-cod__title">\\ud83d\\udcb0 Cash on delivery</p>' +
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
      '<p class="wb-cod__title">\\ud83d\\udcb0 Cash on delivery details</p>' +
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
    button.textContent = 'Placing your order\\u2026';
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
        esc(STATUS_LABEL[id] || id) + (now ? ' \\u2014 current' : '') + '</li>';
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
        return '<div class="wb-line"><div class="wb-line__media">' + esc(line.emoji || '\\ud83d\\udce6') + '</div>' +
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
        ? '<div class="wb-cod" style="margin-top:.8rem"><p class="wb-cod__title">\\ud83d\\udcb0 Pay the courier</p>' +
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
    root.innerHTML = '<p class="wb-form__note">Loading order ' + esc(no) + '\\u2026</p>';
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
    rowsHtml: function (o) { return o.items.map(function (i) { return i.name + ' \\u00d7 ' + i.qty; }).join(', '); }
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
`.trim();