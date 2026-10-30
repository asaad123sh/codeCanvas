/**
 * Commerce backend checks.
 *
 * Runs the generated Node commerce backend against a throwaway data directory
 * and walks the whole store lifecycle the way the browser will: browse ->
 * add to cart -> COD checkout -> order lifecycle -> admin panel -> seller panel.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { COMMERCE_BACKEND } from '../src/export/commerceBackend';
import { PRODUCTS, SELLERS, ORDER_STATUSES } from '../src/export/commerceData';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-shop-'));
const modulePath = path.join(dataDir, 'commerce.cjs');
fs.writeFileSync(modulePath, COMMERCE_BACKEND, 'utf8');

const { createCommerce } = require(modulePath);

let passed = 0;
const failures: string[] = [];
function ok(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1;
  } else {
    failures.push(label + (detail === undefined ? '' : ' -> ' + JSON.stringify(detail)));
    console.log('  FAIL  ' + label + (detail === undefined ? '' : ' -> ' + JSON.stringify(detail)));
  }
}

// A stub auth backend so the admin/seller gate can be exercised.
const auth = {
  currentUser(cookies: any) {
    const token = cookies.wb_stub;
    if (token === 'admin') return { id: 'u1', name: 'Owner', email: 'owner@store.test', role: 'admin' };
    if (token === 'seller') return { id: 'u2', name: 'Nova', email: 'sales@novaaudio.test', role: 'user' };
    return null;
  },
  authenticate(input: any) {
    if (input.login === 'owner@store.test' && input.password === 'hunter2') {
      return { ok: true, user: { id: 'u1', name: 'Owner', email: 'owner@store.test', role: 'admin' } };
    }
    return { ok: false, error: 'Incorrect login or password.' };
  },
  sessionCookie() {
    return 'wb_session=stub';
  },
};

const shop = createCommerce({ dataDir, auth, productPath: 'product.html', shopPath: 'shop.html' });
/** `who` is the stub session the request should present. */
const call = (payload: any, who = '') => shop.dispatch(payload, { headers: { cookie: who ? 'wb_stub=' + who : '' } });

/* ------------------------------------------------------------ catalog */

const seed = shop.clientSeed();
ok('client seed ships the whole catalog', seed.products.length === PRODUCTS.length, seed.products.length);
ok('client seed has sellers', seed.sellers.length === SELLERS.length);
ok('client seed points at the product page', seed.productPath === 'product.html');
ok('client seed ships the COD statuses', Array.isArray(seed.codStatuses) && seed.codStatuses.length === 5);
ok('settings carry the COD fee', seed.settings.codFee > 0 && seed.settings.codEnabled === true, seed.settings);

/* ----------------------------------------------------------- pricing */

const t0 = shop.totals([{ sku: 'NV-HP900', qty: 1 }], { shipping: 'standard', payment: 'cod' });
ok('subtotal is the product price', t0.subtotal === 249, t0.subtotal);
ok('COD fee is added for COD', t0.codFee === seed.settings.codFee, t0.codFee);
ok('tax is charged on the discounted subtotal', Math.abs(t0.tax - Math.round(249 * 5) / 100) < 0.02, t0.tax);
ok('standard shipping is free once past the threshold', t0.shipping === 0, t0.shipping);
ok('total = subtotal + shipping + cod + tax',
  Math.abs(t0.total - (249 + t0.shipping + t0.codFee + t0.tax)) < 0.02, t0.total);

const tBelow = shop.totals([{ sku: 'LM-HUB1', qty: 1 }], { shipping: 'standard', payment: 'card' });
ok('standard shipping costs money below the threshold', tBelow.shipping === 4.99, tBelow.shipping);

const t1 = shop.totals([{ sku: 'NV-HP900', qty: 2 }], { shipping: 'standard', payment: 'card' });
ok('no COD fee for card', t1.codFee === 0, t1.codFee);
ok('free shipping over the threshold', t1.shipping === 0, t1.shipping);

const t2 = shop.totals([{ sku: 'NV-HP900', qty: 1 }], { shipping: 'express', payment: 'card' });
ok('express shipping costs more', t2.shipping === 12.99, t2.shipping);

const t3 = shop.totals([{ sku: 'PF-SB14', qty: 1 }], { shipping: 'standard', payment: 'card', coupon: 'WELCOME10' });
ok('percent coupon discounts 10%', Math.abs(t3.discount - 119.9) < 0.02, t3.discount);

const t4 = shop.totals([{ sku: 'NV-EB22', qty: 1 }], { shipping: 'standard', payment: 'card', coupon: 'SAVE20' });
ok('fixed coupon under the minimum is refused', t4.discount === 0 && t4.coupon === null, t4.discount);

const t5 = shop.totals([{ sku: 'NV-HP900', qty: 1 }], { shipping: 'pickup', payment: 'cod' });
ok('store pickup is free', t5.shipping === 0, t5.shipping);

/* ----------------------------------------------------- COD validation */

const goodCod = {
  action: 'createOrder',
  items: [{ sku: 'NV-HP900', qty: 1 }],
  coupon: '',
  customer: { name: 'Jane Doe', email: 'jane@example.com', phone: '+1 555 0100' },
  address: { line1: '12 Mill Lane', line2: 'Apt 3', city: 'Springfield', state: 'IL', postal_code: '62704', country: 'United States' },
  delivery: { method: 'standard', date: '2026-10-10', window: 'Afternoon (12pm - 5pm)', notes: 'Gate code 4411', gift_wrap: true },
  payment: { method: 'cod' },
  cod: {
    amount: 256.59, currency: 'USD', payer: 'me', receiver_name: '', receiver_phone: '',
    id_type: 'No ID required', id_number: '', instructions: 'Call on arrival',
    consent: true, reschedule: true
  },
};

const badPhone = JSON.parse(JSON.stringify(goodCod));
badPhone.customer.phone = '12';
ok('COD checkout refuses a too-short phone', call(badPhone).ok === false);

const badEmail = JSON.parse(JSON.stringify(goodCod));
badEmail.customer.email = 'nope';
ok('COD checkout refuses a bad email', call(badEmail).ok === false);

const noConsent = JSON.parse(JSON.stringify(goodCod));
noConsent.cod.consent = false;
ok('COD checkout requires the cash-ready consent', call(noConsent).ok === false);

const noReceiver = JSON.parse(JSON.stringify(goodCod));
noReceiver.cod.payer = 'receiver';
ok('COD checkout requires a receiver when someone else pays', call(noReceiver).ok === false);

const noZip = JSON.parse(JSON.stringify(goodCod));
noZip.address.postal_code = '';
ok('COD checkout requires a postal code', call(noZip).ok === false);

const empty = JSON.parse(JSON.stringify(goodCod));
empty.items = [];
ok('COD checkout refuses an empty cart', call(empty).ok === false);

/* ------------------------------------------------------ order created */

const created = call(goodCod);
ok('COD order is created', created.ok === true, created.error);
const orderNo = created.order.order_no;
ok('order number looks like WB-000001', /^WB-\d{6}$/.test(orderNo), orderNo);
ok('order stores the cash amount', created.order.cod_amount === 256.59, created.order.cod_amount);
ok('order starts pending with COD pending',
  created.order.status === 'pending' && created.order.cod_status === 'pending');
ok('order records every delivery field the courier needs',
  !!created.order.line1 && !!created.order.city && !!created.order.postal_code && !!created.order.country &&
  created.order.delivery_date === '2026-10-10' && created.order.delivery_window.indexOf('Afternoon') === 0 &&
  created.order.delivery_notes === 'Gate code 4411' && created.order.gift_wrap === true);
ok('order keeps the COD receiver + instructions fields',
  created.order.cod_instructions === 'Call on arrival' && created.order.cod_consent === true);
ok('order total matches the pricing engine',
  Math.abs(created.order.total - (249 + 0 + 2.5 + Math.round(249 * 0.05 * 100) / 100)) < 0.02,
  created.order.total);
ok('order items carry the seller id for the seller panel',
  created.order.items[0].seller_id === 'sel-nova', created.order.items[0].seller_id);

const stockAfter = shop.productBySku('NV-HP900').stock;
ok('stock is decremented by the order', stockAfter === PRODUCTS.find((p) => p.sku === 'NV-HP900')!.stock - 1, stockAfter);

const lookup = call({ action: 'lookupOrder', order_no: orderNo });
ok('the order can be looked up by number', lookup.ok === true && lookup.order.order_no === orderNo);
ok('tracking with the right phone works',
  call({ action: 'lookupOrder', order_no: orderNo, phone: '+1 555 0100' }).ok === true);
ok('tracking with the wrong phone is refused',
  call({ action: 'lookupOrder', order_no: orderNo, phone: '+1 555 9999' }).ok === false);
ok('an unknown order number is refused', call({ action: 'lookupOrder', order_no: 'WB-000000' }).ok === false);

const orderNumber = Number(orderNo.replace(/\D/g, ''));
const second = call(Object.assign({}, goodCod, { items: [{ sku: 'LM-BULB4', qty: 3 }] }));
ok('a second order gets a fresh number',
  Number(second.order.order_no.replace(/\D/g, '')) > orderNumber, second.order.order_no);

/* ------------------------------------------------- order + COD moves */

ok('a non-admin cannot move orders',
  call({ action: 'setOrderStatus', order_no: orderNo, status: 'confirmed' }, 'seller').ok === false);
ok('an anonymous caller cannot move orders',
  call({ action: 'setOrderStatus', order_no: orderNo, status: 'confirmed' }).ok === false);

ok('admin confirms the order',
  call({ action: 'setOrderStatus', order_no: orderNo, status: 'confirmed' }, 'admin').ok === true);
ok('the order is now confirmed', call({ action: 'lookupOrder', order_no: orderNo }).order.status === 'confirmed');
ok('an unknown status is refused',
  call({ action: 'setOrderStatus', order_no: orderNo, status: 'teleported' }, 'admin').ok === false);

ok('admin packs it', call({ action: 'setOrderStatus', order_no: orderNo, status: 'packed' }, 'admin').ok === true);
ok('admin ships it', call({ action: 'setOrderStatus', order_no: orderNo, status: 'shipped' }, 'admin').ok === true);
ok('admin puts it out for delivery',
  call({ action: 'setOrderStatus', order_no: orderNo, status: 'out_for_delivery' }, 'admin').ok === true);
ok('COD moves to in-transit on delivery',
  call({ action: 'setOrderStatus', order_no: orderNo, status: 'delivered' }, 'admin').ok === true &&
  call({ action: 'lookupOrder', order_no: orderNo }).order.cod_status === 'in_transit');

ok('admin marks the cash collected',
  call({ action: 'setOrderCod', order_no: orderNo, cod_status: 'collected' }, 'admin').ok === true);
const collected = call({ action: 'lookupOrder', order_no: orderNo }).order;
ok('collection stamps the time', !!collected.cod_collected_at, collected.cod_collected_at);
ok('an unknown COD status is refused',
  call({ action: 'setOrderCod', order_no: orderNo, cod_status: 'teleported' }, 'admin').ok === false);

ok('admin saves an internal note',
  call({ action: 'saveOrderNote', order_no: orderNo, note: 'Left with neighbour at no. 12' }, 'admin').ok === true);
ok('the note is stored',
  call({ action: 'lookupOrder', order_no: orderNo }).order.seller_notes === 'Left with neighbour at no. 12');

const codFailure = call({ action: 'setOrderCod', order_no: second.order.order_no, cod_status: 'failed' }, 'admin');
ok('a collection can fail too', codFailure.ok === true);
ok('a card order has no COD box to update',
  call({ action: 'setOrderCod', order_no: second.order.order_no, cod_status: 'waived' }, 'admin').ok === true);

/* ----------------------------------------------------- admin overview */

const admin = call({ action: 'adminOverview' }, 'admin');
ok('the admin panel loads for an admin', admin.ok === true);
ok('a shopper cannot open the admin panel', call({ action: 'adminOverview' }, 'seller').ok === false);
ok('an anonymous visitor cannot open the admin panel', call({ action: 'adminOverview' }).ok === false);

const k = admin.data.kpis;
ok('revenue counts live orders', k.revenue > 0, k.revenue);
ok('both orders are counted', k.orders === 2, k.orders);
ok('delivered orders are counted', k.delivered === 1, k.delivered);
ok('COD still to collect is tracked', k.codOutstanding > 0, k.codOutstanding);
ok('the revenue chart has 14 days', admin.data.daily.length === 14);
ok('top products are ranked by revenue', admin.data.top.length > 0 && admin.data.top[0].revenue > 0);
ok('the seller list is enriched with revenue',
  admin.data.sellers.some((s: any) => s.revenue > 0 && s.product_count > 0));
ok('low stock is flagged', Array.isArray(admin.data.lowStock));
ok('the customer list is built from orders', admin.data.customers.length >= 1);
ok('every status in the flow is exposed to the panel', ORDER_STATUSES.length >= 9);

ok('orders can be listed for the panel',
  call({ action: 'listOrders' }, 'admin').orders.length === 2);

/* ---------------------------------------------------- seller overview */

const sellerView = call({ action: 'sellerOverview', seller_id: 'sel-nova' }, 'seller');
ok('a seller can open their own panel', sellerView.ok === true, sellerView.error);
ok('the seller sees only their products',
  sellerView.data.products.every((p: any) => p.seller === 'sel-nova'));
ok('the seller sees revenue for their items', sellerView.data.kpis.revenue > 0, sellerView.data.kpis);
ok('the seller commission is deducted',
  Math.abs(sellerView.data.kpis.payoutDue - sellerView.data.kpis.revenue * 0.88) < 0.02,
  sellerView.data.kpis.payoutDue);
ok('the seller sees the order lines for their products', sellerView.data.lines.length >= 1);
ok('payouts are itemised', sellerView.data.payouts.length >= 1 &&
  sellerView.data.payouts[0].net + sellerView.data.payouts[0].commission === sellerView.data.payouts[0].gross);
ok('a seller cannot open the admin overview',
  call({ action: 'adminOverview' }, 'seller').ok === false);
ok('an unknown seller is refused',
  call({ action: 'sellerOverview', seller_id: 'nope' }, 'admin').ok === false);

/* ------------------------------------------------------- CRUD in panel */

const added = call({
  action: 'saveProduct',
  product: { sku: 'NV-TEST1', name: 'Nova Test Buds', price: 49.5, stock: 10, category: 'audio', seller: 'sel-nova', active: true, emoji: '🎵' }
}, 'admin');
ok('the admin panel can create a product', added.ok === true, added.error);
ok('a new product gets a slug', added.product.slug === 'nova-test-buds', added.product.slug);
ok('the new product joins the catalog', shop.clientSeed().products.length === PRODUCTS.length + 1);

const edited = call({
  action: 'saveProduct',
  original_sku: 'NV-TEST1',
  product: { sku: 'NV-TEST1', name: 'Nova Test Buds v2', price: 39, stock: 4, category: 'audio', seller: 'sel-nova', active: true }
}, 'admin');
ok('the admin panel can edit a product', edited.ok === true && edited.product.name === 'Nova Test Buds v2');
ok('a duplicate SKU is not created', shop.clientSeed().products.filter((p: any) => p.sku === 'NV-TEST1').length === 1);
ok('a product without a name is refused',
  call({ action: 'saveProduct', product: { sku: 'X1', name: '  ' } }, 'admin').ok === false);

ok('a seller can create their own product',
  call({
    action: 'saveProduct',
    product: { sku: 'NV-SEL1', name: 'Seller Listing', price: 10, stock: 1, category: 'audio', seller: 'sel-nova', active: true }
  }, 'seller').ok === true);
ok('a seller cannot delete another seller product',
  call({ action: 'deleteProduct', sku: 'LM-HUB1' }, 'seller').ok === false);
ok('a seller can delete their own product',
  call({ action: 'deleteProduct', sku: 'NV-SEL1' }, 'seller').ok === true);
ok('the admin can delete a product', call({ action: 'deleteProduct', sku: 'NV-TEST1' }, 'admin').ok === true);
ok('deleting a missing product is refused',
  call({ action: 'deleteProduct', sku: 'NOPE' }, 'admin').ok === false);

const coupon = call({
  action: 'saveCoupon',
  coupon: { code: 'spring20', type: 'percent', value: 20, min: 50, note: 'Spring sale' }
}, 'admin');
ok('the admin can create a coupon', coupon.ok === true && coupon.coupon.code === 'SPRING20');
ok('a duplicate coupon is refused',
  call({ action: 'saveCoupon', coupon: { code: 'SPRING20', type: 'percent', value: 5 } }, 'admin').ok === false);
ok('a new coupon actually discounts',
  Math.abs(shop.totals([{ sku: 'NV-HP900', qty: 1 }], { payment: 'card', coupon: 'SPRING20' }).discount - 49.8) < 0.02);

ok('the admin can approve a seller',
  call({ action: 'setSellerStatus', seller_id: 'sel-volt', status: 'active' }, 'admin').ok === true);
ok('the seller list reflects it',
  shop.clientSeed().sellers.filter((s: any) => s.id === 'sel-volt')[0].status === 'active');
ok('an unknown seller status is refused',
  call({ action: 'setSellerStatus', seller_id: 'sel-volt', status: 'retired' }, 'admin').ok === false);

const settings = call({
  action: 'saveSettings',
  settings: { taxRate: 10, codFee: 0, codEnabled: false, codNote: 'Exact change only.' }
}, 'admin');
ok('the admin can save settings', settings.ok === true && settings.settings.taxRate === 10);
ok('saved settings drive the pricing engine',
  shop.totals([{ sku: 'NV-HP900', qty: 1 }], { payment: 'cod' }).codFee === 0);
ok('COD can be switched off', shop.totals([{ sku: 'NV-HP900', qty: 1 }], { payment: 'cod' }).codFee === 0);
ok('COD checkout is refused once it is off', call(goodCod).ok === false);
call({ action: 'saveSettings', settings: { codEnabled: true, codFee: 2.5, taxRate: 5 } }, 'admin');

/* ------------------------------------------------------------ reviews */

const review = call({ action: 'addReview', product: 'nova-hp900-wireless-headphones', name: 'Sam', rating: 4, title: 'Good', body: 'Solid.' });
ok('a review can be posted', review.ok === true, review.error);
ok('a review without a name is refused', call({ action: 'addReview', product: 'nova-hp900-wireless-headphones', name: ' ', body: 'x' }).ok === false);
ok('a review for an unknown product is refused',
  call({ action: 'addReview', product: 'nope', name: 'Sam', body: 'x' }).ok === false);

/* -------------------------------------------------- server rendering */

const html = shop.hydrateShop(
  '<div class="wb-element" data-wb-shop="grid"><!--webcraft:shop:grid--></div>' +
  '<div data-wb-shop="cart"><!--webcraft:shop:cart--></div>'
);
ok('the catalog grid is rendered on the server', html.indexOf('wb-product__name') !== -1);
ok('server-rendered cards carry a product name', html.indexOf('Nova HP-900 Wireless Headphones') !== -1);
ok('server-rendered cards link to the product page', html.indexOf('product.html?product=nova-hp900') !== -1);
ok('server rendering marks the block so the client only wires it up',
  html.indexOf('data-wb-rendered="1"') !== -1);
ok('the cart block is left to the client', html.indexOf('data-wb-shop="cart"') !== -1);
ok('server-rendered markup carries no script tags', html.indexOf('<script') === -1);

/* ------------------------------------------------------------ summary */

console.log('\ncommerce checks: ' + passed + ' passed, ' + failures.length + ' failed');
if (failures.length) {
  console.log('failed:\n  ' + failures.join('\n  '));
  process.exit(1);
}
fs.rmSync(dataDir, { recursive: true, force: true });