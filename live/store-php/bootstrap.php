<?php
/**
 * Shared runtime for every generated page.
 *
 * Owns auth, contact-form handling, search and the session/CSRF fill-in so the
 * per-page files stay tiny.
 */
declare(strict_types=1);

define('WB_DATA_DIR', __DIR__ . '/data');
if (!is_dir(WB_DATA_DIR)) {
    @mkdir(WB_DATA_DIR, 0775, true);
}
if (!file_exists(WB_DATA_DIR . '/secret.key')) {
    @file_put_contents(WB_DATA_DIR . '/secret.key', bin2hex(random_bytes(32)));
    @chmod(WB_DATA_DIR . '/secret.key', 0600);
}
define('WB_SECRET_FILE', trim((string) @file_get_contents(WB_DATA_DIR . '/secret.key')));

require __DIR__ . '/auth.php';
require __DIR__ . '/search.php';
require __DIR__ . '/commerce.php';

// The store runtime needs to know where the generated pages live so cart links,
// the product page and the COD confirmation all resolve.
$GLOBALS['WB_SHOP_SEED_FILE'] = WB_DATA_DIR . '/shop-seed.php';
$GLOBALS['WB_SHOP_FILE'] = WB_DATA_DIR . '/shop.json';
$GLOBALS['WB_SHOP_DIR'] = WB_DATA_DIR;
$GLOBALS['WB_SHOP_PATHS'] = json_decode(<<<'WEBCRAFT_SHOP_PATHS'
{
    "product": "product.php",
    "shop": "shop.php",
    "checkout": "checkout.php",
    "confirmation": "order-confirmation.php",
    "track": "track-order.php",
    "api": "/api/shop"
}
WEBCRAFT_SHOP_PATHS
, true);
if (function_exists('wb_shop_handle_api')) {
    wb_shop_handle_api();
}

/** Per-page SEO, filled in by the generator. */
function wb_seo(): array {
    return json_decode(<<<'WEBCRAFT_SEO'
{
    "page-index": {
        "title": "Northwind Electronics — gear that works as hard as you do",
        "description": "Audio, wearables, computing and smart home gear with next-day delivery and cash on delivery.",
        "keywords": "electronics, audio, smart home, cash on delivery",
        "author": "Northwind"
    },
    "page-shop": {
        "title": "Shop all products — Northwind Electronics",
        "description": "Browse the full catalog by category, filter by price, search and sort.",
        "keywords": "electronics, audio, smart home, cash on delivery",
        "author": "Northwind"
    },
    "page-product": {
        "title": "Product — Northwind Electronics",
        "description": "Full specifications, stock and delivery options for this product.",
        "keywords": "electronics, audio, smart home, cash on delivery",
        "author": "Northwind"
    },
    "page-cart": {
        "title": "Your cart — Northwind Electronics",
        "description": "Review your basket, apply a coupon and choose a delivery speed.",
        "keywords": "electronics, audio, smart home, cash on delivery",
        "author": "Northwind"
    },
    "page-checkout": {
        "title": "Checkout — Northwind Electronics",
        "description": "Delivery details and payment. Cash on delivery is available on every order.",
        "keywords": "electronics, audio, smart home, cash on delivery",
        "author": "Northwind"
    },
    "page-order-confirmation": {
        "title": "Order confirmation — Northwind Electronics",
        "description": "Thank you for your order. Here is what happens next.",
        "keywords": "electronics, audio, smart home, cash on delivery",
        "author": "Northwind"
    },
    "page-track-order": {
        "title": "Track your order — Northwind Electronics",
        "description": "Enter your order number and the phone number used at checkout.",
        "keywords": "electronics, audio, smart home, cash on delivery",
        "author": "Northwind"
    },
    "page-wishlist": {
        "title": "Your wishlist — Northwind Electronics",
        "description": "Everything you saved for later.",
        "keywords": "electronics, audio, smart home, cash on delivery",
        "author": "Northwind"
    },
    "page-cash-on-delivery": {
        "title": "Cash on delivery — Northwind Electronics",
        "description": "Everything about paying the courier in cash: fees, what to prepare and how it works.",
        "keywords": "electronics, audio, smart home, cash on delivery",
        "author": "Northwind"
    },
    "page-about": {
        "title": "About us — Northwind Electronics",
        "description": "Who we are, how we pick products and how our sellers work.",
        "keywords": "electronics, audio, smart home, cash on delivery",
        "author": "Northwind"
    },
    "page-contact": {
        "title": "Contact us — Northwind Electronics",
        "description": "Questions about an order, a return or a product? Send us a message.",
        "keywords": "electronics, audio, smart home, cash on delivery",
        "author": "Northwind"
    },
    "page-admin": {
        "title": "Admin panel — Northwind Electronics",
        "description": "Orders, products, sellers, coupons, customers and store settings.",
        "keywords": "electronics, audio, smart home, cash on delivery",
        "author": "Northwind"
    },
    "page-seller": {
        "title": "Seller panel — Northwind Electronics",
        "description": "Listings, order fulfilment, payouts and store profile.",
        "keywords": "electronics, audio, smart home, cash on delivery",
        "author": "Northwind"
    }
}
WEBCRAFT_SEO
, true);
}

/* ---- Form handler: contact forms post back to this same URL ---- */
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && isset($_POST['_webcraft_form'])) {
    $row = array('submitted_at' => date('c'));
    foreach ($_POST as $key => $value) {
        // Never write credentials, tokens or internal markers to disk.
        if (strpos((string) $key, '_') === 0) {
            continue;
        }
        if (preg_match('/pass|token|secret|csrf/i', (string) $key)) {
            continue;
        }
        if (is_array($value)) {
            $value = implode(', ', array_map('strval', $value));
        }
        $row[ preg_replace('/[^a-z0-9_]+/i', '_', (string) $key) ] = substr(trim((string) $value), 0, 5000);
    }

    $dir      = WB_DATA_DIR . '/submissions';
    $file     = $dir . '/submissions.csv';
    $isFresh  = !file_exists($file);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    $handle = @fopen($file, 'a');
    if ($handle) {
        if ($isFresh) {
            fputcsv($handle, array_keys($row));
        }
        fputcsv($handle, array_values($row));
        fclose($handle);
    }

    header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?') . '?sent=1');
    exit;
}

/**
 * Print the finished document.
 *
 * $markup is the rendered page; $raw is the same markup before the session
 * panel is filled in, so the search index never contains a session name.
 */
function wb_render_page(string $markup, string $pageId, string $pageName): void {
    $sent = isset($_GET['sent']);
    $meta = wb_seo();
    $seo = $meta[$pageId] ?? array('title' => $pageName, 'description' => '', 'keywords' => '', 'author' => '');
    $currentUser = wb_session_user();

    $document = str_replace(
        array('<!--webcraft:session-->', '__WEBCRAFT_CSRF__', ' data-webcraft-session>'),
        array(
            $currentUser
                ? '<p class="wb-login__who">Signed in as <strong>' . htmlspecialchars($currentUser['name'], ENT_QUOTES) . '</strong></p>'
                  . '<form method="post" class="wb-login__logout"><input type="hidden" name="_webcraft_auth" value="logout">'
                  . '<input type="hidden" name="_wc_csrf" value="' . htmlspecialchars($_COOKIE[WEBCRAFT_CSRF_COOKIE] ?? '', ENT_QUOTES) . '">'
                  . '<button type="submit" class="wb-login__submit">Sign out</button></form>'
                : '<p class="wb-login__who">You are not signed in.</p>',
            htmlspecialchars($_COOKIE[WEBCRAFT_CSRF_COOKIE] ?? '', ENT_QUOTES),
            $currentUser ? ' data-webcraft-session>' : ' data-webcraft-session hidden>',
        ),
        $markup
    );

    // Search answers ?s=... with ranked results instead of the raw markup.
    $document = wb_render_search($document, '', $markup);
    // Fill the store blocks (catalog, featured products) server side.
    $document = wb_shop_hydrate($document);
    $title = $seo['title'];
    $description = $seo['description'];
    $keywords = $seo['keywords'];
    $author = $seo['author'];
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= htmlspecialchars($title) ?></title>
<?php if ($description !== ''): ?>
    <meta name="description" content="<?= htmlspecialchars($description) ?>">
<?php endif; ?>
<?php if ($keywords !== ''): ?>
    <meta name="keywords" content="<?= htmlspecialchars($keywords) ?>">
<?php endif; ?>
<?php if ($author !== ''): ?>
    <meta name="author" content="<?= htmlspecialchars($author) ?>">
<?php endif; ?>
    <link rel="stylesheet" href="style.css">
</head>
<body>
<?= $sent ? '<div class="wb-form-success">Thanks! Your message has been sent.</div>' : '' ?>
<?= $document ?>
    <script>window.__WB_SHOP__ = <?= json_encode(wb_shop_client_seed(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;</script>
    <script src="script.js" defer></script>
</body>
</html>
<?php
}
