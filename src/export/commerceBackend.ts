/**
 * E-commerce backend for the generated Node server (and for the local
 * "Test Live Website" server, so both run the exact same code).
 *
 * Storage is one JSON document - `data/shop.json` - seeded from the same
 * catalog the builder preview shows, so the first request already has a full
 * store. Actions are a single POST endpoint (`/api/shop`) with an `action`
 * field: that keeps the Node route table and the PHP router in step.
 *
 * The catalog, product detail and featured blocks are rendered into the HTML on
 * the server (so product names are in the source for crawlers); everything that
 * depends on the visitor - cart, checkout, order history, the panels - is
 * rendered by the client from the same JSON.
 */

import { seedJSON } from './commerceData';

export const COMMERCE_BACKEND = `
'use strict';
var fs = require('node:fs');
var path = require('node:path');

var SEED = ${seedJSON()};
var COD_STATUSES = ['pending', 'in_transit', 'collected', 'failed', 'waived'];
var SHIPPING_FEE_PICKUP = 0;

function createCommerce(options) {
  options = options || {};
  var dataDir = options.dataDir || path.join(process.cwd(), 'data');
  var shopFile = path.join(dataDir, 'shop.json');
  var auth = options.auth || null;
  var productPath = options.productPath || 'product.html';
  var shopPath = options.shopPath || '';
  var checkoutPath = options.checkoutPath || 'checkout.html';
  var confirmationPath = options.confirmationPath || 'order-confirmation.html';
  var trackPath = options.trackPath || 'track-order.html';

  /* ------------------------------------------------------------ storage */

  function defaults() {
    return {
      products: SEED.products,
      sellers: SEED.sellers,
      coupons: SEED.coupons,
      orders: [],
      customers: [],
      reviews: [],
      settings: SEED.settings
    };
  }
  function read() {
    try {
      if (!fs.existsSync(shopFile)) return defaults();
      var parsed = JSON.parse(fs.readFileSync(shopFile, 'utf8'));
      var base = defaults();
      return {
        products: parsed.products || base.products,
        sellers: parsed.sellers || base.sellers,
        coupons: parsed.coupons || base.coupons,
        orders: parsed.orders || [],
        customers: parsed.customers || [],
        reviews: parsed.reviews || [],
        settings: Object.assign({}, base.settings, parsed.settings || {})
      };
    } catch (e) {
      return defaults();
    }
  }
  function write(store) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(shopFile, JSON.stringify(store, null, 2));
  }

  /* ------------------------------------------------------------ helpers */

  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function money(n) {
    var parts = round2(n).toFixed(2).split('.');
    return (read().settings.currency || '$') + parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',') + '.' + parts[1];
  }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function slugify(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  }
  function nextOrderNo() {
    var orders = read().orders;
    var n = orders.length;
    for (var i = 0; i < orders.length; i++) {
      var digits = String(orders[i].order_no || '').replace(/\\D/g, '');
      if (digits && Number(digits) > n) n = Number(digits);
    }
    return 'WB-' + String(n + 100001);
  }
  function isEmail(value) { return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(value || '')); }

  function productBySku(sku) {
    var list = read().products;
    for (var i = 0; i < list.length; i++) if (list[i].sku === sku) return list[i];
    return null;
  }
  function settings() { return read().settings; }

  /** Mirror of the client pricing engine - the server never trusts a posted total. */
  function totals(items, opts) {
    opts = opts || {};
    var store = read();
    var s = store.settings;
    var lines = [], subtotal = 0;
    (items || []).forEach(function (line) {
      var p = productBySku(line.sku);
      if (!p || !p.active) return;
      var qty = Math.max(0, Math.min(99, parseInt(line.qty, 10) || 0));
      if (!qty) return;
      var lineTotal = round2(p.price * qty);
      subtotal = round2(subtotal + lineTotal);
      lines.push({ product: p, qty: qty, total: lineTotal });
    });

    var coupon = null;
    (store.coupons || []).forEach(function (c) {
      if (String(c.code).toUpperCase() === String(opts.coupon || '').toUpperCase()) coupon = c;
    });
    var usable = !!coupon && (!coupon.min || subtotal >= coupon.min);
    var discount = 0, freeShip = false;
    if (usable && coupon) {
      if (coupon.type === 'percent') discount = round2(subtotal * coupon.value / 100);
      else if (coupon.type === 'fixed') discount = coupon.value;
      else if (coupon.type === 'shipping') freeShip = true;
      discount = Math.min(discount, subtotal);
    }

    var shipId = opts.shipping || 'standard';
    var shipRow = null;
    (SEED.shipping || []).forEach(function (r) { if (r.id === shipId) shipRow = r; });
    if (!shipRow) shipRow = SEED.shipping[0];
    var shipping = 0;
    if (subtotal > 0) {
      var qualifies = freeShip || (s.freeShippingOver && shipRow.id === 'standard' && subtotal >= s.freeShippingOver);
      shipping = qualifies ? 0 : shipRow.fee;
    }

    var codEnabled = s.codEnabled !== false;
    var codFee = (opts.payment === 'cod' && codEnabled && s.codFee && subtotal > 0) ? s.codFee : 0;
    var discounted = Math.max(0, round2(subtotal - discount));
    var tax = round2(discounted * (Number(s.taxRate) || 0) / 100);

    return {
      lines: lines, subtotal: subtotal, discount: discount, coupon: usable ? coupon : null,
      shipping: shipping, shippingRow: shipRow, codFee: codFee, tax: tax,
      total: round2(discounted + shipping + codFee + tax),
      count: lines.reduce(function (a, l) { return a + l.qty; }, 0)
    };
  }

  function etaFor(method) {
    var days = { standard: 5, express: 2, pickup: 0 }[method] || 5;
    return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  }

  function orderTotals(o) {
    return round2((o.subtotal || 0) - (o.discount || 0) + (o.shipping_fee || 0) + (o.cod_fee || 0) + (o.tax || 0));
  }

  /* ------------------------------------------------------------- orders */

  function createOrder(payload) {
    var customer = payload.customer || {};
    var address = payload.address || {};
    var delivery = payload.delivery || {};
    var payment = payload.payment || {};
    var cod = payload.cod || null;

    if (!customer.name) return { ok: false, error: 'Enter the full name for the delivery.' };
    if (!isEmail(customer.email)) return { ok: false, error: 'Enter a valid email address.' };
    if (String(customer.phone || '').replace(/[^0-9]/g, '').length < 7) {
      return { ok: false, error: 'Enter a phone number the courier can reach.' };
    }
    if (!address.line1) return { ok: false, error: 'Enter the street address.' };
    if (!address.city) return { ok: false, error: 'Enter the city.' };
    if (String(address.postal_code || '').length < 3) return { ok: false, error: 'Enter the postal code.' };
    if (!address.country) return { ok: false, error: 'Choose a delivery country.' };

    var t = totals(payload.items, { shipping: delivery.method, payment: payment.method, coupon: payload.coupon });
    if (!t.count) return { ok: false, error: 'Your cart is empty.' };

    var s = settings();
    if (payment.method === 'cod' && s.codEnabled === false) {
      return { ok: false, error: 'Cash on delivery is not available right now.' };
    }
    if (cod) {
      var amount = Number(cod.amount);
      if (!isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter the cash amount to collect.' };
      if (cod.payer && cod.payer !== 'me' && !cod.receiver_name) {
        return { ok: false, error: 'Enter who will receive the parcel.' };
      }
      if (!cod.consent) {
        return { ok: false, error: 'Please confirm you will have the exact cash ready.' };
      }
    }

    var store = read();
    var order = {
      order_no: nextOrderNo(),
      created_at: new Date().toISOString(),
      status: 'pending',
      customer: customer,
      customer_name: customer.name,
      email: customer.email,
      phone: customer.phone,
      line1: address.line1,
      line2: address.line2 || '',
      city: address.city,
      state: address.state || '',
      postal_code: address.postal_code,
      country: address.country,
      shipping_method: delivery.method,
      delivery_date: delivery.date || '',
      delivery_window: delivery.window || 'Any time',
      delivery_notes: delivery.notes || '',
      gift_wrap: !!delivery.gift_wrap,
      payment_method: payment.method,
      cod_amount: cod ? Number(cod.amount) : 0,
      cod_currency: cod ? (cod.currency || s.currencyCode) : '',
      cod_payer: cod ? (cod.payer || 'me') : '',
      cod_receiver_name: cod ? (cod.receiver_name || '') : '',
      cod_receiver_phone: cod ? (cod.receiver_phone || '') : '',
      cod_instructions: cod ? (cod.instructions || '') : '',
      cod_id_type: cod ? (cod.id_type || '') : '',
      cod_id_number: cod ? (cod.id_number || '') : '',
      cod_consent: cod ? !!cod.consent : false,
      cod_reschedule: cod ? cod.reschedule !== false : false,
      cod_status: cod ? 'pending' : '',
      cod_collected_at: '',
      discount: t.discount,
      coupon_code: t.coupon ? t.coupon.code : '',
      shipping_fee: t.shipping,
      cod_fee: t.codFee,
      tax: t.tax,
      subtotal: t.subtotal,
      total: t.total,
      eta: etaFor(delivery.method),
      items: t.lines.map(function (l) {
        return {
          sku: l.product.sku, name: l.product.name, price: l.product.price, qty: l.qty,
          seller_id: l.product.seller, emoji: l.product.emoji
        };
      })
    };
    order.total = orderTotals(order);

    store.orders.unshift(order);
    // Decrement stock so the storefront cannot oversell.
    order.items.forEach(function (line) {
      store.products.forEach(function (p) {
        if (p.sku === line.sku) p.stock = Math.max(0, Number(p.stock || 0) - line.qty);
      });
    });
    if (t.coupon) {
      store.coupons.forEach(function (c) { if (c.code === t.coupon.code) c.used = (c.used || 0) + 1; });
    }
    // Upsert the customer so the admin panel has a customer list.
    var existing = null;
    store.customers.forEach(function (c) {
      if (String(c.email).toLowerCase() === String(customer.email).toLowerCase()) existing = c;
    });
    if (existing) {
      existing.orders = (existing.orders || 0) + 1;
      existing.spent = round2((existing.spent || 0) + order.total);
      existing.phone = customer.phone;
      existing.city = address.city;
    } else {
      store.customers.push({
        name: customer.name, email: customer.email, phone: customer.phone,
        city: address.city, orders: 1, spent: order.total, created_at: order.created_at
      });
    }
    write(store);
    return { ok: true, order: order };
  }

  function findOrder(orderNo) {
    var list = read().orders;
    var needle = String(orderNo || '').toUpperCase();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].order_no).toUpperCase() === needle) return list[i];
    }
    return null;
  }

  function lookupOrder(payload) {
    var order = findOrder(payload.order_no);
    if (!order) return { ok: false, error: 'We could not find that order number.' };
    if (payload.phone) {
      var a = String(payload.phone).replace(/[^0-9]/g, '');
      var b = String(order.phone || '').replace(/[^0-9]/g, '');
      if (a && b && a.slice(-7) !== b.slice(-7)) {
        return { ok: false, error: 'The phone number does not match this order.' };
      }
    }
    return { ok: true, order: order };
  }

  function setOrderStatus(payload) {
    var known = {};
    (SEED.statuses || []).forEach(function (s) {
      known[s.id] = true;
      (s.next || []).forEach(function (n) { known[n] = true; });
    });
    if (!known[payload.status]) return { ok: false, error: 'Unknown status.' };
    var store = read();
    var order = null;
    store.orders.forEach(function (o) { if (o.order_no === payload.order_no) order = o; });
    if (!order) return { ok: false, error: 'Order not found.' };
    order.status = payload.status;
    if (payload.status === 'delivered' && order.payment_method === 'cod' && order.cod_status === 'pending') {
      order.cod_status = 'in_transit';
    }
    write(store);
    return { ok: true, order: order };
  }

  function setOrderCod(payload) {
    if (COD_STATUSES.indexOf(payload.cod_status) === -1) return { ok: false, error: 'Unknown COD status.' };
    var store = read();
    var order = null;
    store.orders.forEach(function (o) { if (o.order_no === payload.order_no) order = o; });
    if (!order) return { ok: false, error: 'Order not found.' };
    if (order.payment_method !== 'cod') return { ok: false, error: 'That order is not a cash order.' };
    order.cod_status = payload.cod_status;
    order.cod_collected_at = payload.cod_status === 'collected' ? new Date().toISOString() : '';
    write(store);
    return { ok: true, order: order };
  }

  function saveOrderNote(payload) {
    var store = read();
    var order = null;
    store.orders.forEach(function (o) { if (o.order_no === payload.order_no) order = o; });
    if (!order) return { ok: false, error: 'Order not found.' };
    order.seller_notes = String(payload.note || '').slice(0, 400);
    write(store);
    return { ok: true, order: order };
  }

  /* -------------------------------------------------- admin overviews */

  function adminOverview() {
    var store = read();
    var live = store.orders.filter(function (o) { return o.status !== 'cancelled' && o.status !== 'returned'; });
    var revenue = round2(live.reduce(function (a, o) { return a + (o.total || 0); }, 0));
    var refunded = round2(store.orders.filter(function (o) { return o.status === 'refunded'; })
      .reduce(function (a, o) { return a + (o.total || 0); }, 0));
    var codOutstanding = round2(store.orders.filter(function (o) {
      return o.payment_method === 'cod' && o.cod_status !== 'collected' && o.status !== 'cancelled';
    }).reduce(function (a, o) { return a + (o.cod_amount || 0); }, 0));

    var daily = [];
    var byDay = {};
    live.forEach(function (o) {
      var day = String(o.created_at || '').slice(0, 10);
      if (!day) return;
      byDay[day] = round2((byDay[day] || 0) + (o.total || 0));
    });
    for (var d = 13; d >= 0; d--) {
      var key = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
      daily.push({ day: key, revenue: byDay[key] || 0 });
    }

    var perProduct = {};
    live.forEach(function (o) {
      (o.items || []).forEach(function (i) {
        if (!perProduct[i.sku]) perProduct[i.sku] = { sku: i.sku, name: i.name, qty: 0, revenue: 0 };
        perProduct[i.sku].qty += i.qty;
        perProduct[i.sku].revenue = round2(perProduct[i.sku].revenue + i.qty * i.price);
      });
    });
    var top = Object.keys(perProduct).map(function (k) { return perProduct[k]; })
      .sort(function (a, b) { return b.revenue - a.revenue; }).slice(0, 6);

    var sellers = store.sellers.map(function (s) {
      var gross = 0, count = 0;
      live.forEach(function (o) {
        (o.items || []).forEach(function (i) {
          if (i.seller_id === s.id) { gross = round2(gross + i.qty * i.price); count += 1; }
        });
      });
      return Object.assign({}, s, {
        revenue: gross,
        product_count: store.products.filter(function (p) { return p.seller === s.id; }).length,
        line_count: count
      });
    });

    var lowStock = store.products.filter(function (p) {
      return p.active && Number(p.stock) <= (store.settings.lowStockAt || 10);
    }).map(function (p) { return { sku: p.sku, name: p.name, stock: p.stock }; });

    return {
      kpis: {
        revenue: revenue,
        orders: store.orders.length,
        aov: store.orders.length ? round2(revenue / live.length) : 0,
        pending: store.orders.filter(function (o) { return o.status === 'pending'; }).length,
        delivered: store.orders.filter(function (o) { return o.status === 'delivered'; }).length,
        refunded: refunded,
        codOutstanding: codOutstanding
      },
      daily: daily,
      top: top,
      recent: store.orders.slice(0, 10),
      orders: store.orders,
      products: store.products,
      categories: SEED.categories,
      sellers: sellers,
      coupons: store.coupons,
      customers: store.customers,
      reviews: store.reviews,
      settings: store.settings,
      lowStock: lowStock
    };
  }

  function sellerOverview(sellerId) {
    var store = read();
    var seller = null;
    store.sellers.forEach(function (s) { if (s.id === sellerId) seller = s; });
    if (!seller) return { ok: false, error: 'Unknown seller.' };

    var orders = store.orders.filter(function (o) {
      return (o.items || []).some(function (i) { return i.seller_id === sellerId; });
    });
    var live = orders.filter(function (o) { return o.status !== 'cancelled'; });
    var rate = Number(seller.commission || 0) / 100;

    var revenue = 0, items = 0;
    var lines = [];
    var payouts = [];
    live.forEach(function (o) {
      var gross = 0, orderLines = 0;
      (o.items || []).forEach(function (i) {
        if (i.seller_id !== sellerId) return;
        var lineTotal = round2(i.qty * i.price);
        gross = round2(gross + lineTotal);
        orderLines += 1;
        items += i.qty;
        lines.push({
          order_no: o.order_no, name: i.name, qty: i.qty, status: o.status,
          created_at: o.created_at, payout: round2(lineTotal * (1 - rate))
        });
      });
      if (gross > 0) {
        revenue = round2(revenue + gross);
        payouts.push({
          order_no: o.order_no, lines: orderLines, gross: gross,
          commission: round2(gross * rate), net: round2(gross * (1 - rate)), status: o.status
        });
      }
    });

    var products = store.products.filter(function (p) { return p.seller === sellerId; }).map(function (p) {
      var sold = 0;
      live.forEach(function (o) {
        (o.items || []).forEach(function (i) { if (i.sku === p.sku) sold += i.qty; });
      });
      return Object.assign({}, p, { sold: sold, revenue: round2(sold * p.price) });
    });

    return {
      ok: true,
      data: {
        seller: seller,
        kpis: {
          revenue: revenue,
          orders: orders.length,
          items: items,
          commission: round2(revenue * rate),
          payoutDue: round2(revenue * (1 - rate)),
          pending: orders.filter(function (o) { return o.status === 'pending'; }).length
        },
        products: products,
        orders: orders,
        lines: lines,
        payouts: payouts,
        categories: SEED.categories,
        sellers: store.sellers,
        settings: store.settings
      }
    };
  }

  /* --------------------------------------------------------- mutations */

  function saveProduct(payload) {
    var p = payload.product || {};
    var sku = String(p.sku || '').trim();
    if (!sku) return { ok: false, error: 'A SKU is required.' };
    if (!String(p.name || '').trim()) return { ok: false, error: 'A product name is required.' };
    if (!(Number(p.price) >= 0)) return { ok: false, error: 'Enter a valid price.' };

    var store = read();
    var target = null;
    store.products.forEach(function (row) { if (row.sku === payload.original_sku || row.sku === sku) target = row; });
    var base = target || {};
    var slug = slugify(p.name) || slugify(sku);
    var clash = false;
    store.products.forEach(function (row) { if (row.slug === slug && row.sku !== (target && target.sku)) clash = true; });
    if (clash) slug = slug + '-' + String(Date.now()).slice(-4);

    var merged = Object.assign({}, base, {
      sku: sku,
      slug: base.slug && base.sku === sku ? base.slug : slug,
      name: String(p.name).trim(),
      category: p.category || base.category || SEED.categories[0].slug,
      seller: p.seller || base.seller || store.sellers[0].id,
      price: round2(p.price),
      compareAt: round2(p.compareAt || 0),
      stock: Math.max(0, parseInt(p.stock, 10) || 0),
      rating: base.rating || 0,
      reviews: base.reviews || 0,
      badge: p.badge || '',
      emoji: p.emoji || base.emoji || '📦',
      tint: p.tint || base.tint || '#eef2ff',
      blurb: p.blurb || base.blurb || '',
      specs: base.specs || {},
      active: p.active !== false
    });
    if (target) target.sku = sku;
    if (!target) store.products.unshift(merged);
    write(store);
    return { ok: true, product: merged };
  }

  function deleteProduct(payload) {
    var store = read();
    var before = store.products.length;
    store.products = store.products.filter(function (p) { return p.sku !== payload.sku; });
    if (store.products.length === before) return { ok: false, error: 'Product not found.' };
    write(store);
    return { ok: true };
  }

  function saveCoupon(payload) {
    var c = payload.coupon || {};
    var code = String(c.code || '').trim().toUpperCase();
    if (!code) return { ok: false, error: 'Enter a coupon code.' };
    var store = read();
    var clash = store.coupons.some(function (row) {
      return row.code === code && row.code !== payload.original_code;
    });
    if (clash) return { ok: false, error: 'That coupon code already exists.' };
    var row = {
      code: code, type: c.type || 'percent', value: Number(c.value) || 0,
      min: Number(c.min) || 0, note: c.note || '', used: 0, max_uses: 0
    };
    var existing = null;
    store.coupons.forEach(function (r) { if (r.code === code) existing = r; });
    if (existing) Object.assign(existing, row, { used: existing.used || 0 });
    else store.coupons.push(row);
    write(store);
    return { ok: true, coupon: row };
  }

  function saveSettings(payload) {
    var store = read();
    store.settings = Object.assign({}, store.settings, payload.settings || {});
    write(store);
    return { ok: true, settings: store.settings };
  }

  function saveSeller(payload) {
    var store = read();
    var found = null;
    store.sellers.forEach(function (s) { if (s.id === payload.seller_id) found = s; });
    if (!found) return { ok: false, error: 'Unknown seller.' };
    if (payload.seller) {
      if (payload.seller.store) found.store = String(payload.seller.store);
      if (payload.seller.name) found.name = String(payload.seller.name);
      if (payload.seller.email) found.email = String(payload.seller.email);
      if (payload.seller.phone) found.phone = String(payload.seller.phone);
    }
    write(store);
    return { ok: true, seller: found };
  }

  function setSellerStatus(payload) {
    if (['active', 'pending', 'suspended'].indexOf(payload.status) === -1) {
      return { ok: false, error: 'Unknown status.' };
    }
    var store = read();
    var found = null;
    store.sellers.forEach(function (s) { if (s.id === payload.seller_id) found = s; });
    if (!found) return { ok: false, error: 'Unknown seller.' };
    found.status = payload.status;
    write(store);
    return { ok: true, seller: found };
  }

  function addReview(payload) {
    if (!String(payload.name || '').trim()) return { ok: false, error: 'Add your name.' };
    if (!String(payload.body || '').trim()) return { ok: false, error: 'Write a short review.' };
    var store = read();
    var product = null;
    store.products.forEach(function (p) { if (p.slug === payload.product) product = p; });
    if (!product) return { ok: false, error: 'Unknown product.' };
    var review = {
      product: product.sku, name: String(payload.name).trim(),
      rating: Math.max(1, Math.min(5, parseInt(payload.rating, 10) || 5)),
      title: String(payload.title || '').trim(),
      body: String(payload.body).trim(), created_at: new Date().toISOString()
    };
    store.reviews.unshift(review);
    var count = 0, sum = 0;
    store.reviews.forEach(function (r) {
      if (r.product === product.sku) { count += 1; sum += r.rating; }
    });
    product.reviews = (product.reviews || 0) + 1;
    product.rating = round2((sum / count) * 10) / 10;
    write(store);
    return { ok: true, review: review };
  }

  /* ------------------------------------------------------------ session */

  function cookies(req) {
    var header = String(req.headers.cookie || '');
    var out = {};
    header.split(';').forEach(function (pair) {
      var idx = pair.indexOf('=');
      if (idx === -1) return;
      out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
    });
    return out;
  }
  function currentUser(req) {
    if (!auth || typeof auth.currentUser !== 'function') return null;
    try { return auth.currentUser(cookies(req)); } catch (e) { return null; }
  }

  /* ------------------------------------------------------------ dispatch */

  function dispatch(payload, req) {
    var action = payload.action;
    if (action === 'session') {
      var user = currentUser(req);
      return { ok: !!user, user: user };
    }
    if (action === 'login') {
      if (!auth) return { ok: false, error: 'Accounts are not enabled on this site.' };
      var result = auth.authenticate({ login: payload.login, password: payload.password });
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, user: result.user, setCookie: auth.sessionCookie(result.user, true) };
    }
    if (action === 'createOrder') return createOrder(payload);
    if (action === 'lookupOrder') return lookupOrder(payload);
    if (action === 'addReview') return addReview(payload);
    if (action === 'listOrders') return { ok: true, orders: read().orders };

    var user = currentUser(req);
    var isAdmin = !!(user && user.role === 'admin');
    var seller = null;
    if (user && user.email) {
      var list = read().sellers;
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].email).toLowerCase() === String(user.email).toLowerCase()) seller = list[i];
      }
    }
    var isSeller = !!seller || isAdmin;

    if (!isSeller) return { ok: false, error: 'Sign in with a seller or admin account to use this panel.' };

    if (action === 'adminOverview') {
      if (!isAdmin) return { ok: false, error: 'Admin access only.' };
      return { ok: true, data: adminOverview() };
    }
    if (action === 'sellerOverview') {
      var target = payload.seller_id || (seller && seller.id) || (isAdmin ? read().sellers[0].id : '');
      if (isAdmin && payload.seller_id) target = payload.seller_id;
      else if (!isAdmin) target = seller.id;
      return sellerOverview(target);
    }
    if (action === 'setOrderStatus' || action === 'setOrderCod' || action === 'saveOrderNote') {
      if (!isAdmin) return { ok: false, error: 'Admin access only.' };
      if (action === 'setOrderStatus') return setOrderStatus(payload);
      if (action === 'setOrderCod') return setOrderCod(payload);
      return saveOrderNote(payload);
    }
    if (action === 'setSellerStatus' || action === 'saveSeller') {
      if (!isAdmin) return { ok: false, error: 'Admin access only.' };
      if (action === 'setSellerStatus') return setSellerStatus(payload);
      payload.seller_id = seller.id;
      return saveSeller(payload);
    }
    if (action === 'saveCoupon' || action === 'saveSettings') {
      if (!isAdmin) return { ok: false, error: 'Admin access only.' };
      if (action === 'saveCoupon') return saveCoupon(payload);
      return saveSettings(payload);
    }
    if (action === 'saveProduct') {
      if (!isAdmin && seller && payload.product && payload.product.seller !== seller.id) {
        payload.product.seller = seller.id;
      }
      return saveProduct(payload);
    }
    if (action === 'deleteProduct') {
      if (!isAdmin) {
        var owned = productBySku(payload.sku);
        if (!owned || owned.seller !== (seller && seller.id)) {
          return { ok: false, error: 'You can only delete your own products.' };
        }
      }
      return deleteProduct(payload);
    }
    return { ok: false, error: 'Unknown action.' };
  }

  /* -------------------------------------------------- server rendering */

  function starsHtml(rating) {
    var full = Math.round(Number(rating) || 0);
    var out = '';
    for (var i = 1; i <= 5; i++) out += i <= full ? '\\u2605' : '\\u2606';
    return '<span class="wb-stars">' + out + '</span>';
  }

  function cardHtml(p) {
    var s = settings();
    var off = p.compareAt && p.compareAt > p.price ? round2(p.compareAt - p.price) : 0;
    var out = Number(p.stock) <= 0 || !p.active;
    var url = productPath + '?product=' + encodeURIComponent(p.slug);
    var stockClass = Number(p.stock) <= (s.lowStockAt || 10) ? ' is-low' : '';
    return '<article class="wb-product" data-sku="' + esc(p.sku) + '">' +
      (p.badge ? '<span class="wb-product__badge">' + esc(p.badge) + '</span>' : '') +
      '<a class="wb-product__media" href="' + esc(url) + '" style="background:' + esc(p.tint) + '">' + esc(p.emoji) + '</a>' +
      '<div class="wb-product__body">' +
      '<a class="wb-product__name" href="' + esc(url) + '">' + esc(p.name) + '</a>' +
      '<p class="wb-product__blurb">' + esc(p.blurb) + '</p>' +
      '<div class="wb-product__meta">' + starsHtml(p.rating) + ' ' + esc(p.rating) + ' (' + p.reviews + ')</div>' +
      '<div class="wb-product__price"><b>' + money(p.price) + '</b>' +
      (off ? '<s>' + money(p.compareAt) + '</s><em>-' + money(off) + '</em>' : '') + '</div>' +
      '<span class="wb-product__stock' + (out ? ' is-out' : stockClass) + '">' +
      (out ? (p.active ? 'Out of stock' : 'Unavailable') : 'In stock (' + p.stock + ' left)') + '</span>' +
      '<div class="wb-product__actions">' +
      '<button class="wb-btn wb-btn--primary" data-wb-add="' + esc(p.sku) + '"' + (out ? ' disabled' : '') + '>' +
      (out ? 'Unavailable' : 'Add to cart') + '</button>' +
      '<button class="wb-btn wb-btn--ghost" data-wb-wish="' + esc(p.sku) + '">\\u2661</button>' +
      '</div></div></article>';
  }

  /**
   * Fill the shop markers a page shipped with, so crawlers and no-JS visitors
   * see the catalog. Client-only blocks (cart, checkout, panels) keep their
   * marker: they depend on the visitor, not the page.
   */
  function hydrateShop(html) {
    var store = read();
    var products = store.products.filter(function (p) { return p.active; });
    var out = String(html || '');

    var blocks = {
      grid: '<div class="wb-shop__grid">' + products.map(cardHtml).join('') + '</div>',
      featured: '<div class="wb-shop__grid">' +
        products.filter(function (p) { return p.badge; }).slice(0, 4).map(cardHtml).join('') +
        '</div>'
    };

    Object.keys(blocks).forEach(function (kind) {
      var marker = '<!--webcraft:shop:' + kind + '-->';
      if (out.indexOf(marker) === -1) return;
      out = out.split(marker).join(blocks[kind]);
      // Tell the client this block already has content so it only wires it up.
      out = out.replace(
        new RegExp('<div([^>]*data-wb-shop="' + kind + '"[^>]*?)>'),
        function (whole, attrs) {
          if (attrs.indexOf('data-wb-rendered') !== -1) return whole;
          return '<div' + attrs + ' data-wb-rendered="1">';
        }
      );
    });
    return out;
  }

  /** The JSON the client reads, always in sync with what is on disk. */
  function clientSeed() {
    var store = read();
    return Object.assign({}, SEED, {
      products: store.products,
      sellers: store.sellers,
      coupons: store.coupons,
      settings: store.settings,
      codStatuses: COD_STATUSES,
      productPath: productPath,
      shopPath: shopPath,
      checkoutPath: checkoutPath,
      confirmationPath: confirmationPath,
      trackPath: trackPath,
      api: options.apiPath || '/api/shop'
    });
  }

  return {
    SEED: SEED,
    read: read,
    write: write,
    totals: totals,
    dispatch: dispatch,
    hydrateShop: hydrateShop,
    clientSeed: clientSeed,
    productBySku: productBySku,
    shopFile: shopFile
  };
}

module.exports = { createCommerce: createCommerce };
`.trim();