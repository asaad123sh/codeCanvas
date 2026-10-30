/**
 * E-commerce backend for the generated PHP store.
 *
 * A line-for-line mirror of `commerceBackend.ts` (same JSON on disk, same
 * pricing engine, same actions) so the PHP export and the Node export behave
 * identically - which is the rule the auth and search runtimes already follow.
 */

export const PHP_COMMERCE = `<?php
/**
 * WebCraft Pro e-commerce runtime.
 *
 * Catalog, cart pricing, orders, cash on delivery, the admin panel API and the
 * seller panel API. Storage is one JSON document so the store works on any host
 * with no database; swap wb_shop_store() for PDO when you outgrow it.
 */

define('WB_SHOP_COD_STATUSES', ['pending', 'in_transit', 'collected', 'failed', 'waived']);

/* ------------------------------------------------------------------ store */

function wb_shop_seed() {
    global $WB_SHOP_SEED_FILE;
    return require $WB_SHOP_SEED_FILE;
}

function wb_shop_defaults() {
    $seed = wb_shop_seed();
    return [
        'products'  => $seed['products'],
        'sellers'   => $seed['sellers'],
        'coupons'   => $seed['coupons'],
        'orders'    => [],
        'customers' => [],
        'reviews'   => [],
        'settings'  => $seed['settings'],
    ];
}

function wb_shop_store() {
    global $WB_SHOP_FILE;
    if (!file_exists($WB_SHOP_FILE)) {
        return wb_shop_defaults();
    }
    $raw = @file_get_contents($WB_SHOP_FILE);
    $parsed = $raw ? json_decode($raw, true) : null;
    if (!is_array($parsed)) {
        return wb_shop_defaults();
    }
    $base = wb_shop_defaults();
    return [
        'products'  => isset($parsed['products']) ? $parsed['products'] : $base['products'],
        'sellers'   => isset($parsed['sellers']) ? $parsed['sellers'] : $base['sellers'],
        'coupons'   => isset($parsed['coupons']) ? $parsed['coupons'] : $base['coupons'],
        'orders'    => isset($parsed['orders']) ? $parsed['orders'] : [],
        'customers' => isset($parsed['customers']) ? $parsed['customers'] : [],
        'reviews'   => isset($parsed['reviews']) ? $parsed['reviews'] : [],
        'settings'  => array_merge($base['settings'], isset($parsed['settings']) ? $parsed['settings'] : []),
    ];
}

function wb_shop_write($store) {
    global $WB_SHOP_FILE, $WB_SHOP_DIR;
    if (!is_dir($WB_SHOP_DIR)) {
        @mkdir($WB_SHOP_DIR, 0775, true);
    }
    file_put_contents($WB_SHOP_FILE, json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

/* ----------------------------------------------------------------- helpers */

function wb_shop_round($n) {
    return round((float) $n, 2);
}

function wb_shop_settings() {
    $store = wb_shop_store();
    return $store['settings'];
}

function wb_shop_money($n) {
    $s = wb_shop_settings();
    return ($s['currency'] ?? '$') . number_format((float) $n, 2);
}

function wb_shop_esc($value) {
    return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES, 'UTF-8');
}

function wb_shop_slug($value) {
    $slug = strtolower(preg_replace('/[^a-z0-9]+/', '-', (string) $value));
    return trim($slug, '-');
}

function wb_shop_product($sku) {
    $store = wb_shop_store();
    foreach ($store['products'] as $p) {
        if ($p['sku'] === $sku) {
            return $p;
        }
    }
    return null;
}

function wb_shop_next_order_no() {
    $store = wb_shop_store();
    $n = count($store['orders']);
    foreach ($store['orders'] as $o) {
        $digits = preg_replace('/\\D/', '', (string) $o['order_no']);
        if ($digits !== '' && (int) $digits > $n) {
            $n = (int) $digits;
        }
    }
    return 'WB-' . ($n + 100001);
}

function wb_shop_is_email($value) {
    return (bool) filter_var((string) $value, FILTER_VALIDATE_EMAIL);
}

function wb_shop_eta($method) {
    $days = ['standard' => 5, 'express' => 2, 'pickup' => 0][$method] ?? 5;
    return date('Y-m-d', time() + $days * 86400);
}

/**
 * Mirror of the client pricing engine - the server never trusts a posted total.
 */
function wb_shop_totals($items, $opts = []) {
    $store = wb_shop_store();
    $s = $store['settings'];
    $seed = wb_shop_seed();

    $lines = [];
    $subtotal = 0.0;
    foreach ((array) $items as $line) {
        $p = wb_shop_product($line['sku'] ?? '');
        if (!$p || empty($p['active'])) {
            continue;
        }
        $qty = max(0, min(99, (int) ($line['qty'] ?? 0)));
        if (!$qty) {
            continue;
        }
        $lineTotal = wb_shop_round($p['price'] * $qty);
        $subtotal = wb_shop_round($subtotal + $lineTotal);
        $lines[] = ['product' => $p, 'qty' => $qty, 'total' => $lineTotal];
    }

    $coupon = null;
    $wanted = strtoupper((string) ($opts['coupon'] ?? ''));
    foreach ($store['coupons'] as $c) {
        if (strtoupper($c['code']) === $wanted) {
            $coupon = $c;
        }
    }
    $usable = $coupon && (empty($coupon['min']) || $subtotal >= $coupon['min']);
    $discount = 0.0;
    $freeShip = false;
    if ($usable) {
        if ($coupon['type'] === 'percent') {
            $discount = wb_shop_round($subtotal * $coupon['value'] / 100);
        } elseif ($coupon['type'] === 'fixed') {
            $discount = (float) $coupon['value'];
        } elseif ($coupon['type'] === 'shipping') {
            $freeShip = true;
        }
        $discount = min($discount, $subtotal);
    }

    $shipId = $opts['shipping'] ?? 'standard';
    $shipRow = $seed['shipping'][0];
    foreach ($seed['shipping'] as $r) {
        if ($r['id'] === $shipId) {
            $shipRow = $r;
        }
    }
    $shipping = 0.0;
    if ($subtotal > 0) {
        $qualifies = $freeShip || (!empty($s['freeShippingOver']) && $shipRow['id'] === 'standard'
            && $subtotal >= $s['freeShippingOver']);
        $shipping = $qualifies ? 0.0 : (float) $shipRow['fee'];
    }

    $codEnabled = ($s['codEnabled'] ?? true) !== false;
    $codFee = (($opts['payment'] ?? 'cod') === 'cod' && $codEnabled && !empty($s['codFee']) && $subtotal > 0)
        ? (float) $s['codFee'] : 0.0;
    $discounted = max(0.0, wb_shop_round($subtotal - $discount));
    $tax = wb_shop_round($discounted * ((float) ($s['taxRate'] ?? 0)) / 100);
    $count = 0;
    foreach ($lines as $l) {
        $count += $l['qty'];
    }

    return [
        'lines'     => $lines,
        'subtotal'  => $subtotal,
        'discount'  => $discount,
        'coupon'    => $usable ? $coupon : null,
        'shipping'  => $shipping,
        'shipRow'   => $shipRow,
        'codFee'    => $codFee,
        'tax'       => $tax,
        'total'     => wb_shop_round($discounted + $shipping + $codFee + $tax),
        'count'     => $count,
    ];
}

/* ----------------------------------------------------------------- orders */

function wb_shop_create_order($payload) {
    $customer = $payload['customer'] ?? [];
    $address  = $payload['address'] ?? [];
    $delivery = $payload['delivery'] ?? [];
    $payment  = $payload['payment'] ?? [];
    $cod      = $payload['cod'] ?? null;

    if (empty($customer['name'])) {
        return ['ok' => false, 'error' => 'Enter the full name for the delivery.'];
    }
    if (!wb_shop_is_email($customer['email'] ?? '')) {
        return ['ok' => false, 'error' => 'Enter a valid email address.'];
    }
    if (strlen(preg_replace('/\\D/', '', (string) ($customer['phone'] ?? ''))) < 7) {
        return ['ok' => false, 'error' => 'Enter a phone number the courier can reach.'];
    }
    if (empty($address['line1'])) {
        return ['ok' => false, 'error' => 'Enter the street address.'];
    }
    if (empty($address['city'])) {
        return ['ok' => false, 'error' => 'Enter the city.'];
    }
    if (strlen((string) ($address['postal_code'] ?? '')) < 3) {
        return ['ok' => false, 'error' => 'Enter the postal code.'];
    }
    if (empty($address['country'])) {
        return ['ok' => false, 'error' => 'Choose a delivery country.'];
    }

    $t = wb_shop_totals($payload['items'] ?? [], [
        'shipping' => $delivery['method'] ?? 'standard',
        'payment'  => $payment['method'] ?? 'cod',
        'coupon'   => $payload['coupon'] ?? '',
    ]);
    if (!$t['count']) {
        return ['ok' => false, 'error' => 'Your cart is empty.'];
    }

    $s = wb_shop_settings();
    $codEnabled = ($s['codEnabled'] ?? true) !== false;
    if (($payment['method'] ?? 'cod') === 'cod' && !$codEnabled) {
        return ['ok' => false, 'error' => 'Cash on delivery is not available right now.'];
    }
    if ($cod) {
        $amount = (float) ($cod['amount'] ?? 0);
        if ($amount <= 0) {
            return ['ok' => false, 'error' => 'Enter the cash amount to collect.'];
        }
        if (!empty($cod['payer']) && $cod['payer'] !== 'me' && empty($cod['receiver_name'])) {
            return ['ok' => false, 'error' => 'Enter who will receive the parcel.'];
        }
        if (empty($cod['consent'])) {
            return ['ok' => false, 'error' => 'Please confirm you will have the exact cash ready.'];
        }
    }

    $store = wb_shop_store();
    $order = [
        'order_no'           => wb_shop_next_order_no(),
        'created_at'         => date('c'),
        'status'             => 'pending',
        'customer'           => $customer,
        'customer_name'      => $customer['name'],
        'email'              => $customer['email'],
        'phone'              => $customer['phone'],
        'line1'              => $address['line1'],
        'line2'              => $address['line2'] ?? '',
        'city'               => $address['city'],
        'state'              => $address['state'] ?? '',
        'postal_code'        => $address['postal_code'],
        'country'            => $address['country'],
        'shipping_method'    => $delivery['method'] ?? 'standard',
        'delivery_date'      => $delivery['date'] ?? '',
        'delivery_window'    => $delivery['window'] ?? 'Any time',
        'delivery_notes'     => $delivery['notes'] ?? '',
        'gift_wrap'          => !empty($delivery['gift_wrap']),
        'payment_method'     => $payment['method'] ?? 'cod',
        'cod_amount'         => $cod ? (float) $cod['amount'] : 0,
        'cod_currency'       => $cod ? ($cod['currency'] ?? ($s['currencyCode'] ?? 'USD')) : '',
        'cod_payer'          => $cod ? ($cod['payer'] ?? 'me') : '',
        'cod_receiver_name'  => $cod ? ($cod['receiver_name'] ?? '') : '',
        'cod_receiver_phone' => $cod ? ($cod['receiver_phone'] ?? '') : '',
        'cod_instructions'   => $cod ? ($cod['instructions'] ?? '') : '',
        'cod_id_type'        => $cod ? ($cod['id_type'] ?? '') : '',
        'cod_id_number'      => $cod ? ($cod['id_number'] ?? '') : '',
        'cod_consent'        => $cod ? !empty($cod['consent']) : false,
        'cod_reschedule'     => $cod ? (($cod['reschedule'] ?? true) !== false) : false,
        'cod_status'         => $cod ? 'pending' : '',
        'cod_collected_at'   => '',
        'discount'           => $t['discount'],
        'coupon_code'        => $t['coupon'] ? $t['coupon']['code'] : '',
        'shipping_fee'       => $t['shipping'],
        'cod_fee'            => $t['codFee'],
        'tax'                => $t['tax'],
        'subtotal'           => $t['subtotal'],
        'total'              => $t['total'],
        'eta'                => wb_shop_eta($delivery['method'] ?? 'standard'),
        'items'              => [],
    ];
    foreach ($t['lines'] as $l) {
        $order['items'][] = [
            'sku'       => $l['product']['sku'],
            'name'      => $l['product']['name'],
            'price'     => $l['product']['price'],
            'qty'       => $l['qty'],
            'seller_id' => $l['product']['seller'],
            'emoji'     => $l['product']['emoji'],
        ];
    }

    array_unshift($store['orders'], $order);

    // Decrement stock so the storefront cannot oversell.
    foreach ($order['items'] as $line) {
        foreach ($store['products'] as $i => $p) {
            if ($p['sku'] === $line['sku']) {
                $store['products'][$i]['stock'] = max(0, (int) $p['stock'] - $line['qty']);
            }
        }
    }
    if ($t['coupon']) {
        foreach ($store['coupons'] as $i => $c) {
            if ($c['code'] === $t['coupon']['code']) {
                $store['coupons'][$i]['used'] = (int) ($c['used'] ?? 0) + 1;
            }
        }
    }

    // Upsert the customer so the admin panel has a customer list.
    $existing = null;
    foreach ($store['customers'] as $i => $c) {
        if (strtolower($c['email']) === strtolower($customer['email'])) {
            $existing = $i;
        }
    }
    if ($existing !== null) {
        $store['customers'][$existing]['orders'] = (int) ($store['customers'][$existing]['orders'] ?? 0) + 1;
        $store['customers'][$existing]['spent'] = wb_shop_round(
            ($store['customers'][$existing]['spent'] ?? 0) + $order['total']
        );
        $store['customers'][$existing]['phone'] = $customer['phone'];
        $store['customers'][$existing]['city'] = $address['city'];
    } else {
        $store['customers'][] = [
            'name' => $customer['name'], 'email' => $customer['email'], 'phone' => $customer['phone'],
            'city' => $address['city'], 'orders' => 1, 'spent' => $order['total'],
            'created_at' => $order['created_at'],
        ];
    }

    wb_shop_write($store);
    return ['ok' => true, 'order' => $order];
}

function wb_shop_find_order($orderNo) {
    $needle = strtoupper((string) $orderNo);
    foreach (wb_shop_store()['orders'] as $o) {
        if (strtoupper($o['order_no']) === $needle) {
            return $o;
        }
    }
    return null;
}

function wb_shop_lookup_order($payload) {
    $order = wb_shop_find_order($payload['order_no'] ?? '');
    if (!$order) {
        return ['ok' => false, 'error' => 'We could not find that order number.'];
    }
    if (!empty($payload['phone'])) {
        $a = preg_replace('/\\D/', '', (string) $payload['phone']);
        $b = preg_replace('/\\D/', '', (string) ($order['phone'] ?? ''));
        if ($a !== '' && $b !== '' && substr($a, -7) !== substr($b, -7)) {
            return ['ok' => false, 'error' => 'The phone number does not match this order.'];
        }
    }
    return ['ok' => true, 'order' => $order];
}

function wb_shop_set_order_status($payload) {
    $seed = wb_shop_seed();
    $known = [];
    foreach ($seed['statuses'] as $s) {
        $known[$s['id']] = true;
        foreach ($s['next'] ?? [] as $n) {
            $known[$n] = true;
        }
    }
    if (!isset($known[$payload['status'] ?? ''])) {
        return ['ok' => false, 'error' => 'Unknown status.'];
    }
    $store = wb_shop_store();
    foreach ($store['orders'] as $i => $o) {
        if ($o['order_no'] === $payload['order_no']) {
            $store['orders'][$i]['status'] = $payload['status'];
            if ($payload['status'] === 'delivered' && $o['payment_method'] === 'cod'
                && ($o['cod_status'] ?? 'pending') === 'pending') {
                $store['orders'][$i]['cod_status'] = 'in_transit';
            }
            wb_shop_write($store);
            return ['ok' => true, 'order' => $store['orders'][$i]];
        }
    }
    return ['ok' => false, 'error' => 'Order not found.'];
}

function wb_shop_set_order_cod($payload) {
    if (!in_array($payload['cod_status'] ?? '', WB_SHOP_COD_STATUSES, true)) {
        return ['ok' => false, 'error' => 'Unknown COD status.'];
    }
    $store = wb_shop_store();
    foreach ($store['orders'] as $i => $o) {
        if ($o['order_no'] === $payload['order_no']) {
            if (($o['payment_method'] ?? '') !== 'cod') {
                return ['ok' => false, 'error' => 'That order is not a cash order.'];
            }
            $store['orders'][$i]['cod_status'] = $payload['cod_status'];
            $store['orders'][$i]['cod_collected_at'] =
                $payload['cod_status'] === 'collected' ? date('c') : '';
            wb_shop_write($store);
            return ['ok' => true, 'order' => $store['orders'][$i]];
        }
    }
    return ['ok' => false, 'error' => 'Order not found.'];
}

function wb_shop_save_order_note($payload) {
    $store = wb_shop_store();
    foreach ($store['orders'] as $i => $o) {
        if ($o['order_no'] === $payload['order_no']) {
            $store['orders'][$i]['seller_notes'] = substr((string) ($payload['note'] ?? ''), 0, 400);
            wb_shop_write($store);
            return ['ok' => true, 'order' => $store['orders'][$i]];
        }
    }
    return ['ok' => false, 'error' => 'Order not found.'];
}

/* -------------------------------------------------------------- overviews */

function wb_shop_admin_overview() {
    $store = wb_shop_store();
    $seed = wb_shop_seed();
    $live = array_values(array_filter($store['orders'],
        function ($o) { return $o['status'] !== 'cancelled' && $o['status'] !== 'returned'; }));

    $revenue = 0.0;
    foreach ($live as $o) {
        $revenue = wb_shop_round($revenue + (float) $o['total']);
    }
    $refunded = 0.0;
    $codOutstanding = 0.0;
    $pending = 0;
    $delivered = 0;
    foreach ($store['orders'] as $o) {
        if ($o['status'] === 'refunded') {
            $refunded = wb_shop_round($refunded + (float) $o['total']);
        }
        if ($o['status'] === 'pending') {
            $pending++;
        }
        if ($o['status'] === 'delivered') {
            $delivered++;
        }
        if (($o['payment_method'] ?? '') === 'cod' && ($o['cod_status'] ?? '') !== 'collected'
            && $o['status'] !== 'cancelled') {
            $codOutstanding = wb_shop_round($codOutstanding + (float) $o['cod_amount']);
        }
    }

    $byDay = [];
    foreach ($live as $o) {
        $day = substr((string) $o['created_at'], 0, 10);
        if ($day === '') {
            continue;
        }
        $byDay[$day] = wb_shop_round(($byDay[$day] ?? 0) + (float) $o['total']);
    }
    $daily = [];
    for ($d = 13; $d >= 0; $d--) {
        $key = date('Y-m-d', time() - $d * 86400);
        $daily[] = ['day' => $key, 'revenue' => $byDay[$key] ?? 0];
    }

    $perProduct = [];
    foreach ($live as $o) {
        foreach ($o['items'] ?? [] as $i) {
            if (!isset($perProduct[$i['sku']])) {
                $perProduct[$i['sku']] = ['sku' => $i['sku'], 'name' => $i['name'], 'qty' => 0, 'revenue' => 0.0];
            }
            $perProduct[$i['sku']]['qty'] += $i['qty'];
            $perProduct[$i['sku']]['revenue'] =
                wb_shop_round($perProduct[$i['sku']]['revenue'] + $i['qty'] * $i['price']);
        }
    }
    $top = array_values($perProduct);
    usort($top, function ($a, $b) { return $b['revenue'] <=> $a['revenue']; });
    $top = array_slice($top, 0, 6);

    $sellers = [];
    foreach ($store['sellers'] as $s) {
        $gross = 0.0;
        foreach ($live as $o) {
            foreach ($o['items'] ?? [] as $i) {
                if (($i['seller_id'] ?? '') === $s['id']) {
                    $gross = wb_shop_round($gross + $i['qty'] * $i['price']);
                }
            }
        }
        $count = 0;
        foreach ($store['products'] as $p) {
            if ($p['seller'] === $s['id']) {
                $count++;
            }
        }
        $sellers[] = array_merge($s, ['revenue' => $gross, 'product_count' => $count, 'line_count' => 0]);
    }

    $lowStock = [];
    foreach ($store['products'] as $p) {
        if (!empty($p['active']) && (int) $p['stock'] <= (int) ($store['settings']['lowStockAt'] ?? 10)) {
            $lowStock[] = ['sku' => $p['sku'], 'name' => $p['name'], 'stock' => $p['stock']];
        }
    }

    return [
        'kpis' => [
            'revenue'        => $revenue,
            'orders'         => count($store['orders']),
            'aov'            => $live ? wb_shop_round($revenue / count($live)) : 0,
            'pending'        => $pending,
            'delivered'      => $delivered,
            'refunded'       => $refunded,
            'codOutstanding' => $codOutstanding,
        ],
        'daily'      => $daily,
        'top'        => $top,
        'recent'     => array_slice($store['orders'], 0, 10),
        'orders'     => $store['orders'],
        'products'   => $store['products'],
        'categories' => $seed['categories'],
        'sellers'    => $sellers,
        'coupons'    => $store['coupons'],
        'customers'  => $store['customers'],
        'reviews'    => $store['reviews'],
        'settings'   => $store['settings'],
        'lowStock'   => $lowStock,
    ];
}

function wb_shop_seller_overview($sellerId) {
    $store = wb_shop_store();
    $seed = wb_shop_seed();
    $seller = null;
    foreach ($store['sellers'] as $s) {
        if ($s['id'] === $sellerId) {
            $seller = $s;
        }
    }
    if (!$seller) {
        return ['ok' => false, 'error' => 'Unknown seller.'];
    }

    $orders = [];
    foreach ($store['orders'] as $o) {
        foreach ($o['items'] ?? [] as $i) {
            if (($i['seller_id'] ?? '') === $sellerId) {
                $orders[] = $o;
                break;
            }
        }
    }
    $rate = (float) $seller['commission'] / 100;
    $revenue = 0.0;
    $items = 0;
    $lines = [];
    $payouts = [];

    foreach ($orders as $o) {
        if ($o['status'] === 'cancelled') {
            continue;
        }
        $gross = 0.0;
        $orderLines = 0;
        foreach ($o['items'] ?? [] as $i) {
            if (($i['seller_id'] ?? '') !== $sellerId) {
                continue;
            }
            $lineTotal = wb_shop_round($i['qty'] * $i['price']);
            $gross = wb_shop_round($gross + $lineTotal);
            $orderLines++;
            $items += $i['qty'];
            $lines[] = [
                'order_no' => $o['order_no'], 'name' => $i['name'], 'qty' => $i['qty'],
                'status' => $o['status'], 'created_at' => $o['created_at'],
                'payout' => wb_shop_round($lineTotal * (1 - $rate)),
            ];
        }
        if ($gross > 0) {
            $revenue = wb_shop_round($revenue + $gross);
            $payouts[] = [
                'order_no' => $o['order_no'], 'lines' => $orderLines, 'gross' => $gross,
                'commission' => wb_shop_round($gross * $rate),
                'net' => wb_shop_round($gross * (1 - $rate)), 'status' => $o['status'],
            ];
        }
    }

    $products = [];
    foreach ($store['products'] as $p) {
        if ($p['seller'] !== $sellerId) {
            continue;
        }
        $sold = 0;
        foreach ($orders as $o) {
            if ($o['status'] === 'cancelled') {
                continue;
            }
            foreach ($o['items'] ?? [] as $i) {
                if ($i['sku'] === $p['sku']) {
                    $sold += $i['qty'];
                }
            }
        }
        $products[] = array_merge($p, ['sold' => $sold, 'revenue' => wb_shop_round($sold * $p['price'])]);
    }

    return [
        'ok' => true,
        'data' => [
            'seller'  => $seller,
            'kpis'    => [
                'revenue'   => $revenue,
                'orders'    => count($orders),
                'items'     => $items,
                'commission'=> wb_shop_round($revenue * $rate),
                'payoutDue' => wb_shop_round($revenue * (1 - $rate)),
                'pending'   => count(array_filter($orders, function ($o) { return $o['status'] === 'pending'; })),
            ],
            'products'   => $products,
            'orders'     => $orders,
            'lines'      => $lines,
            'payouts'    => $payouts,
            'categories' => $seed['categories'],
            'sellers'    => $store['sellers'],
            'settings'   => $store['settings'],
        ],
    ];
}

/* ---------------------------------------------------------------- mutations */

function wb_shop_save_product($payload) {
    $p = $payload['product'] ?? [];
    $sku = trim((string) ($p['sku'] ?? ''));
    if ($sku === '') {
        return ['ok' => false, 'error' => 'A SKU is required.'];
    }
    if (trim((string) ($p['name'] ?? '')) === '') {
        return ['ok' => false, 'error' => 'A product name is required.'];
    }
    if (!isset($p['price']) || !is_numeric($p['price']) || $p['price'] < 0) {
        return ['ok' => false, 'error' => 'Enter a valid price.'];
    }

    $store = wb_shop_store();
    $seed = wb_shop_seed();
    $target = null;
    foreach ($store['products'] as $i => $row) {
        if ($row['sku'] === ($payload['original_sku'] ?? '') || $row['sku'] === $sku) {
            $target = $i;
        }
    }
    $base = $target !== null ? $store['products'][$target] : [];
    $slug = wb_shop_slug($p['name'] ?: $sku) ?: wb_shop_slug($sku);
    foreach ($store['products'] as $i => $row) {
        if ($row['slug'] === $slug && ($target === null || $i !== $target)) {
            $slug .= '-' . substr((string) time(), -4);
            break;
        }
    }

    $merged = array_merge($base, [
        'sku'       => $sku,
        'slug'      => (($base['sku'] ?? '') === $sku && !empty($base['slug'])) ? $base['slug'] : $slug,
        'name'      => trim((string) $p['name']),
        'category'  => $p['category'] ?? ($base['category'] ?? $seed['categories'][0]['slug']),
        'seller'    => $p['seller'] ?? ($base['seller'] ?? $store['sellers'][0]['id']),
        'price'     => wb_shop_round($p['price']),
        'compareAt' => wb_shop_round($p['compareAt'] ?? 0),
        'stock'     => max(0, (int) ($p['stock'] ?? 0)),
        'rating'    => $base['rating'] ?? 0,
        'reviews'   => $base['reviews'] ?? 0,
        'badge'     => $p['badge'] ?? '',
        'emoji'     => $p['emoji'] ?? ($base['emoji'] ?? '📦'),
        'tint'      => $p['tint'] ?? ($base['tint'] ?? '#eef2ff'),
        'blurb'     => $p['blurb'] ?? ($base['blurb'] ?? ''),
        'specs'     => $base['specs'] ?? [],
        'active'    => ($p['active'] ?? true) !== false,
    ]);

    if ($target !== null) {
        $store['products'][$target] = $merged;
    } else {
        array_unshift($store['products'], $merged);
    }
    wb_shop_write($store);
    return ['ok' => true, 'product' => $merged];
}

function wb_shop_delete_product($payload) {
    $store = wb_shop_store();
    $before = count($store['products']);
    $store['products'] = array_values(array_filter($store['products'],
        function ($p) use ($payload) { return $p['sku'] !== $payload['sku']; }));
    if (count($store['products']) === $before) {
        return ['ok' => false, 'error' => 'Product not found.'];
    }
    wb_shop_write($store);
    return ['ok' => true];
}

function wb_shop_save_coupon($payload) {
    $c = $payload['coupon'] ?? [];
    $code = strtoupper(trim((string) ($c['code'] ?? '')));
    if ($code === '') {
        return ['ok' => false, 'error' => 'Enter a coupon code.'];
    }
    $store = wb_shop_store();
    foreach ($store['coupons'] as $row) {
        if ($row['code'] === $code && $row['code'] !== ($payload['original_code'] ?? null)) {
            return ['ok' => false, 'error' => 'That coupon code already exists.'];
        }
    }
    $new = [
        'code' => $code, 'type' => $c['type'] ?? 'percent', 'value' => (float) ($c['value'] ?? 0),
        'min' => (float) ($c['min'] ?? 0), 'note' => $c['note'] ?? '', 'used' => 0, 'max_uses' => 0,
    ];
    $found = false;
    foreach ($store['coupons'] as $i => $row) {
        if ($row['code'] === $code) {
            $new['used'] = (int) ($row['used'] ?? 0);
            $store['coupons'][$i] = $new;
            $found = true;
        }
    }
    if (!$found) {
        $store['coupons'][] = $new;
    }
    wb_shop_write($store);
    return ['ok' => true, 'coupon' => $new];
}

function wb_shop_save_settings($payload) {
    $store = wb_shop_store();
    $store['settings'] = array_merge($store['settings'], $payload['settings'] ?? []);
    wb_shop_write($store);
    return ['ok' => true, 'settings' => $store['settings']];
}

function wb_shop_save_seller($payload) {
    $store = wb_shop_store();
    foreach ($store['sellers'] as $i => $s) {
        if ($s['id'] === $payload['seller_id']) {
            $in = $payload['seller'] ?? [];
            foreach (['store', 'name', 'email', 'phone'] as $key) {
                if (!empty($in[$key])) {
                    $store['sellers'][$i][$key] = $in[$key];
                }
            }
            wb_shop_write($store);
            return ['ok' => true, 'seller' => $store['sellers'][$i]];
        }
    }
    return ['ok' => false, 'error' => 'Unknown seller.'];
}

function wb_shop_set_seller_status($payload) {
    if (!in_array($payload['status'] ?? '', ['active', 'pending', 'suspended'], true)) {
        return ['ok' => false, 'error' => 'Unknown status.'];
    }
    $store = wb_shop_store();
    foreach ($store['sellers'] as $i => $s) {
        if ($s['id'] === $payload['seller_id']) {
            $store['sellers'][$i]['status'] = $payload['status'];
            wb_shop_write($store);
            return ['ok' => true, 'seller' => $store['sellers'][$i]];
        }
    }
    return ['ok' => false, 'error' => 'Unknown seller.'];
}

function wb_shop_add_review($payload) {
    if (trim((string) ($payload['name'] ?? '')) === '') {
        return ['ok' => false, 'error' => 'Add your name.'];
    }
    if (trim((string) ($payload['body'] ?? '')) === '') {
        return ['ok' => false, 'error' => 'Write a short review.'];
    }
    $store = wb_shop_store();
    $index = null;
    foreach ($store['products'] as $i => $p) {
        if ($p['slug'] === $payload['product']) {
            $index = $i;
        }
    }
    if ($index === null) {
        return ['ok' => false, 'error' => 'Unknown product.'];
    }
    $review = [
        'product' => $store['products'][$index]['sku'],
        'name' => trim((string) $payload['name']),
        'rating' => max(1, min(5, (int) ($payload['rating'] ?? 5))),
        'title' => trim((string) ($payload['title'] ?? '')),
        'body' => trim((string) $payload['body']),
        'created_at' => date('c'),
    ];
    array_unshift($store['reviews'], $review);
    $count = 0;
    $sum = 0;
    foreach ($store['reviews'] as $r) {
        if ($r['product'] === $review['product']) {
            $count++;
            $sum += $r['rating'];
        }
    }
    $store['products'][$index]['reviews'] = (int) $store['products'][$index]['reviews'] + 1;
    $store['products'][$index]['rating'] = round(($sum / $count) * 10) / 10;
    wb_shop_write($store);
    return ['ok' => true, 'review' => $review];
}

/* ----------------------------------------------------------------- session */

function wb_shop_current_user() {
    if (function_exists('wb_session_user')) {
        return wb_session_user();
    }
    return null;
}

function wb_shop_login($payload) {
    $store = wb_shop_store();
    $login = trim((string) ($payload['login'] ?? ''));
    $store2 = wb_shop_store();
    unset($store);
    // The auth runtime owns passwords; reuse it when it is loaded.
    if (function_exists('wb_find_user')) {
        $user = wb_find_user($login);
        $pass = (string) ($payload['password'] ?? '');
        if (!$user || !password_verify($pass, $user['password'])) {
            return ['ok' => false, 'error' => 'Incorrect login or password.'];
        }
        wb_start_session($user, true);
        return ['ok' => true, 'user' => [
            'id' => $user['id'], 'name' => $user['name'], 'email' => $user['email'],
            'role' => $user['role'] ?? 'user', 'createdAt' => $user['created_at'] ?? '',
        ]];
    }
    unset($store2);
    return ['ok' => false, 'error' => 'Accounts are not enabled on this site.'];
}

/* ---------------------------------------------------------------- dispatch */

function wb_shop_dispatch($payload) {
    $action = $payload['action'] ?? '';

    if ($action === 'session') {
        $user = wb_shop_current_user();
        return ['ok' => (bool) $user, 'user' => $user];
    }
    if ($action === 'login') {
        return wb_shop_login($payload);
    }
    if ($action === 'createOrder') {
        return wb_shop_create_order($payload);
    }
    if ($action === 'lookupOrder') {
        return wb_shop_lookup_order($payload);
    }
    if ($action === 'addReview') {
        return wb_shop_add_review($payload);
    }
    if ($action === 'listOrders') {
        return ['ok' => true, 'orders' => wb_shop_store()['orders']];
    }

    $user = wb_shop_current_user();
    $isAdmin = $user && ($user['role'] ?? '') === 'admin';
    $store = wb_shop_store();
    $seller = null;
    if ($user && !empty($user['email'])) {
        foreach ($store['sellers'] as $s) {
            if (strtolower($s['email']) === strtolower($user['email'])) {
                $seller = $s;
            }
        }
    }
    $isSeller = (bool) $seller || $isAdmin;

    if (!$isSeller) {
        return ['ok' => false, 'error' => 'Sign in with a seller or admin account to use this panel.'];
    }

    switch ($action) {
        case 'adminOverview':
            return $isAdmin
                ? ['ok' => true, 'data' => wb_shop_admin_overview()]
                : ['ok' => false, 'error' => 'Admin access only.'];
        case 'sellerOverview':
            if (!$isAdmin) {
                return wb_shop_seller_overview($seller['id']);
            }
            $target = $payload['seller_id'] ?? ($store['sellers'][0]['id'] ?? '');
            return wb_shop_seller_overview($target);
        case 'setOrderStatus':
        case 'setOrderCod':
        case 'saveOrderNote':
            if (!$isAdmin) {
                return ['ok' => false, 'error' => 'Admin access only.'];
            }
            if ($action === 'setOrderStatus') {
                return wb_shop_set_order_status($payload);
            }
            if ($action === 'setOrderCod') {
                return wb_shop_set_order_cod($payload);
            }
            return wb_shop_save_order_note($payload);
        case 'setSellerStatus':
        case 'saveSeller':
            if (!$isAdmin) {
                return ['ok' => false, 'error' => 'Admin access only.'];
            }
            if ($action === 'setSellerStatus') {
                return wb_shop_set_seller_status($payload);
            }
            $payload['seller_id'] = $seller['id'];
            return wb_shop_save_seller($payload);
        case 'saveCoupon':
        case 'saveSettings':
            if (!$isAdmin) {
                return ['ok' => false, 'error' => 'Admin access only.'];
            }
            return $action === 'saveCoupon'
                ? wb_shop_save_coupon($payload)
                : wb_shop_save_settings($payload);
        case 'saveProduct':
            if (!$isAdmin && $seller && isset($payload['product'])) {
                $payload['product']['seller'] = $seller['id'];
            }
            return wb_shop_save_product($payload);
        case 'deleteProduct':
            if (!$isAdmin) {
                $owned = wb_shop_product($payload['sku']);
                if (!$owned || $owned['seller'] !== ($seller['id'] ?? '')) {
                    return ['ok' => false, 'error' => 'You can only delete your own products.'];
                }
            }
            return wb_shop_delete_product($payload);
    }

    return ['ok' => false, 'error' => 'Unknown action.'];
}

/* -------------------------------------------------------- server rendering */

function wb_shop_stars($rating) {
    $full = (int) round((float) $rating);
    $out = '';
    for ($i = 1; $i <= 5; $i++) {
        $out .= $i <= $full ? '★' : '☆';
    }
    return '<span class="wb-stars">' . $out . '</span>';
}

function wb_shop_card_html($p) {
    global $WB_SHOP_PATHS;
    $s = wb_shop_settings();
    $off = (!empty($p['compareAt']) && $p['compareAt'] > $p['price'])
        ? wb_shop_round($p['compareAt'] - $p['price']) : 0;
    $out = (int) $p['stock'] <= 0 || empty($p['active']);
    $url = $WB_SHOP_PATHS['product'] . '?product=' . rawurlencode($p['slug']);
    $stockClass = (int) $p['stock'] <= (int) ($s['lowStockAt'] ?? 10) ? ' is-low' : '';

    return '<article class="wb-product" data-sku="' . wb_shop_esc($p['sku']) . '">' .
        (!empty($p['badge']) ? '<span class="wb-product__badge">' . wb_shop_esc($p['badge']) . '</span>' : '') .
        '<a class="wb-product__media" href="' . wb_shop_esc($url) . '" style="background:' .
            wb_shop_esc($p['tint']) . '">' . wb_shop_esc($p['emoji']) . '</a>' .
        '<div class="wb-product__body">' .
        '<a class="wb-product__name" href="' . wb_shop_esc($url) . '">' . wb_shop_esc($p['name']) . '</a>' .
        '<p class="wb-product__blurb">' . wb_shop_esc($p['blurb']) . '</p>' .
        '<div class="wb-product__meta">' . wb_shop_stars($p['rating']) . ' ' . wb_shop_esc($p['rating']) .
            ' (' . (int) $p['reviews'] . ')</div>' .
        '<div class="wb-product__price"><b>' . wb_shop_money($p['price']) . '</b>' .
            ($off ? '<s>' . wb_shop_money($p['compareAt']) . '</s><em>-' . wb_shop_money($off) . '</em>' : '') .
        '</div>' .
        '<span class="wb-product__stock' . ($out ? ' is-out' : $stockClass) . '">' .
            ($out ? (!empty($p['active']) ? 'Out of stock' : 'Unavailable')
                  : 'In stock (' . (int) $p['stock'] . ' left)') . '</span>' .
        '<div class="wb-product__actions">' .
        '<button class="wb-btn wb-btn--primary" data-wb-add="' . wb_shop_esc($p['sku']) . '"' .
            ($out ? ' disabled' : '') . '>' . ($out ? 'Unavailable' : 'Add to cart') . '</button>' .
        '<button class="wb-btn wb-btn--ghost" data-wb-wish="' . wb_shop_esc($p['sku']) . '">♡</button>' .
        '</div></div></article>';
}

/**
 * Fill the shop markers a page shipped with, so crawlers and no-JS visitors see
 * the catalog. Client-only blocks keep their marker: they depend on the visitor.
 */
function wb_shop_hydrate($html) {
    $store = wb_shop_store();
    $products = array_values(array_filter($store['products'], function ($p) { return !empty($p['active']); }));

    $cards = '';
    foreach ($products as $p) {
        $cards .= wb_shop_card_html($p);
    }
    $featured = '';
    $shown = 0;
    foreach ($products as $p) {
        if (!empty($p['badge']) && $shown < 4) {
            $featured .= wb_shop_card_html($p);
            $shown++;
        }
    }
    $blocks = [
        'grid' => '<div class="wb-shop__grid">' . $cards . '</div>',
        'featured' => '<div class="wb-shop__grid">' . $featured . '</div>',
    ];

    foreach ($blocks as $kind => $body) {
        $marker = '<!--webcraft:shop:' . $kind . '-->';
        if (strpos($html, $marker) === false) {
            continue;
        }
        $html = str_replace($marker, $body, $html);
        $html = preg_replace_callback(
            '/<div([^>]*data-wb-shop="' . $kind . '"[^>]*?)>/',
            function ($m) {
                return strpos($m[1], 'data-wb-rendered') !== false ? $m[0]
                    : '<div' . $m[1] . ' data-wb-rendered="1">';
            },
            $html
        );
    }
    return $html;
}

/** The JSON the client reads, always in sync with what is on disk. */
function wb_shop_client_seed() {
    global $WB_SHOP_SEED_FILE, $WB_SHOP_PATHS;
    $seed = require $WB_SHOP_SEED_FILE;
    $store = wb_shop_store();
    $seed['products'] = $store['products'];
    $seed['sellers'] = $store['sellers'];
    $seed['coupons'] = $store['coupons'];
    $seed['settings'] = $store['settings'];
    $seed['codStatuses'] = WB_SHOP_COD_STATUSES;
    $seed['productPath'] = $WB_SHOP_PATHS['product'];
    $seed['shopPath'] = $WB_SHOP_PATHS['shop'];
    $seed['checkoutPath'] = $WB_SHOP_PATHS['checkout'];
    $seed['confirmationPath'] = $WB_SHOP_PATHS['confirmation'];
    $seed['trackPath'] = $WB_SHOP_PATHS['track'];
    $seed['api'] = $WB_SHOP_PATHS['api'];
    return $seed;
}

/* -------------------------------------------------------------- routing */

/**
 * Answer a POST to the shop API. Returns false when the request is not ours, so
 * the page router can carry on serving HTML.
 */
function wb_shop_handle_api() {
    $path = strtok((string) ($_SERVER['REQUEST_URI'] ?? '/'), '?');
    $isJson = stripos((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== false;
    if (!$isJson && strpos($path, 'api/shop') === false) {
        return false;
    }
    $payload = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        $payload = $_POST;
    }
    $result = wb_shop_dispatch($payload);
    header('Content-Type: application/json');
    echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
`.trim();