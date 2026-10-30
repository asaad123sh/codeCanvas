/**
 * Admin panel + seller panel runtimes.
 *
 * Both are client-rendered from the same `/api/shop` actions the server
 * implements, and both gate on the real session the auth runtime already
 * installs: an admin panel needs `role === 'admin'`, a seller panel needs a
 * seller whose email matches the signed-in account (admins may open any).
 */

export const COMMERCE_PANELS = `
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
      var blob = new Blob([rows.join('\\n')], { type: 'text/csv;charset=utf-8;' });
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
      return /[",\\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
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
              : '\\u2014') + '</td>' +
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
            '<td>' + (Number(c.min) ? money(c.min) : '\\u2014') + '</td>' +
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
`.trim();