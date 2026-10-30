/**
 * The reference storefront.
 *
 * Builds the whole Northwind Electronics site as a `SiteModel` - every page an
 * e-commerce shop actually has - then exports it to PHP and Node so the same
 * document can be verified against a real server.
 *
 * It is also the worked example for the multi-page model: the nav bar and the
 * footer are separate documents, the menu buttons are declared once and each
 * one says where it appears (nav bar, footer, or both) and what it points at
 * (a page, or a `#tag` on a page).
 */

import type {
  ElementNode,
  ElementType,
  PageConfig,
  SiteLink,
  SiteModel,
  SitePage,
} from '../src/types';
import { createDefaultElement } from '../src/engine/elementRegistry';
import { contentPages, slugify } from '../src/store/builderStore';
import { commerceSchema } from '../src/export/commerceData';

let counter = 0;
const nid = () => `sf-${(++counter).toString(36)}`;

type ElSpec = {
  type: ElementType;
  content?: string;
  attributes?: Record<string, unknown>;
  styles?: Record<string, unknown>;
  children?: ElSpec[];
};

/**
 * Block helper: every block below returns a *spec*. The whole spec tree is
 * turned into real nodes in one pass by `build()`, which is what keeps a
 * child's id and the node it points at in step.
 */
const el = (spec: ElSpec): ElSpec => spec;

/**
 * Build one element subtree. Every node it creates is registered in `out`, so
 * a parent's `children` ids always point at nodes that really exist in the map.
 */
function node(
  spec: ElSpec,
  parentId: string | null,
  out: Record<string, ElementNode>
): ElementNode {
  const defaults = createDefaultElement(spec.type);
  const built: ElementNode = {
    ...defaults,
    id: nid(),
    type: spec.type,
    label: defaults.label || spec.type,
    parentId,
    children: [],
    styles: { ...(defaults.styles || {}), ...(spec.styles || {}) } as any,
    attributes: { ...(defaults.attributes || {}), ...(spec.attributes || {}) },
  };
  if (spec.content !== undefined) built.content = spec.content;
  out[built.id] = built;
  for (const child of spec.children || []) {
    built.children.push(node(child, built.id, out).id);
  }
  return built;
}

/** Flatten a spec tree into the `elements` map plus its root ids. */
function build(specs: ElSpec[]): { elements: Record<string, ElementNode>; rootIds: string[] } {
  const elements: Record<string, ElementNode> = {};
  const rootIds: string[] = [];
  const walk = (spec: ElSpec, parentId: string | null) => {
    // `node` registers the whole subtree, so children never go missing.
    const root = node(spec, parentId, elements);
    if (parentId === null) rootIds.push(root.id);
  };
  specs.forEach((spec) => walk(spec, null));
  return { elements, rootIds };
}

const BRAND = {
  ink: '#0f172a',
  muted: '#64748b',
  accent: '#4f46e5',
  accentDark: '#4338ca',
  line: '#e2e8f0',
  soft: '#f8fafc',
  white: '#ffffff',
};

const page = (
  name: string,
  slug: string,
  title: string,
  description: string,
  specs: ElSpec[]
): SitePage => {
  const { elements, rootIds } = build(specs);
  const config: PageConfig = {
    title,
    slug,
    metaTags: { description, keywords: 'electronics, audio, smart home, cash on delivery', author: 'Northwind' },
    globalCSS: '',
    globalJS: '',
    bodyStyles: { fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: BRAND.white, color: BRAND.ink },
  };
  return { id: `page-${slug}`, role: 'page', name, config, elements, rootIds, isHome: slug === 'index' };
};

/* --------------------------------------------------------------- blocks */

const section = (children: ElSpec[], anchor?: string, styles: Record<string, unknown> = {}) =>
  el({
    type: 'section',
    attributes: anchor ? { anchor } : {},
    styles: { padding: '56px 24px', maxWidth: '1180px', margin: '0 auto', ...styles },
    children,
  });

const wrap = (children: ElSpec[], styles: Record<string, unknown> = {}) =>
  el({
    type: 'div',
    styles: { display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', ...styles },
    children,
  });

const heading = (text: string, anchor?: string, size = '32px') =>
  el({
    type: 'heading',
    content: text,
    attributes: { anchor, headingTag: 'h2' },
    styles: { fontSize: size, fontWeight: '800', color: BRAND.ink, margin: '0 0 8px' },
  });

const paragraph = (text: string, styles: Record<string, unknown> = {}) =>
  el({
    type: 'paragraph',
    content: text,
    styles: { fontSize: '15px', lineHeight: '1.7', color: BRAND.muted, margin: '0', ...styles },
  });

const button = (label: string, href: string, anchor?: string, primary = true) =>
  el({
    type: 'button',
    content: label,
    attributes: { href, anchor, textAlign: 'center' },
    styles: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: primary ? BRAND.accent : 'transparent',
      color: primary ? '#fff' : BRAND.ink,
      border: primary ? '1px solid ' + BRAND.accent : '1px solid ' + BRAND.line,
      borderRadius: '10px',
      padding: '12px 22px',
      fontSize: '15px',
      fontWeight: '700',
      cursor: 'pointer',
      width: 'auto',
    },
  });

/** A store block, e.g. the catalog grid or the COD form. */
const shop = (block: string, extra: Record<string, unknown> = {}, styles: Record<string, unknown> = {}) =>
  el({
    type: 'shop-section',
    attributes: { block, ...extra },
    styles: { width: '100%', ...styles },
  });

const card = (children: ElSpec[], anchor?: string) =>
  el({
    type: 'div',
    attributes: anchor ? { anchor } : {},
    styles: {
      border: `1px solid ${BRAND.line}`,
      borderRadius: '16px',
      padding: '28px',
      backgroundColor: BRAND.white,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    children,
  });

const faq = (question: string, answer: string) =>
  card([
    heading(question, undefined, '18px'),
    paragraph(answer),
  ]);

/* ---------------------------------------------------------------- pages */

const HOME = page(
  'Home',
  'index',
  'Northwind Electronics — gear that works as hard as you do',
  'Audio, wearables, computing and smart home gear with next-day delivery and cash on delivery.',
  [
    section(
      [
        wrap(
          [
            el({
              type: 'badge',
              content: 'Free delivery over $150 · Cash on delivery available',
              styles: {
                display: 'inline-block',
                alignSelf: 'center',
                backgroundColor: '#eef2ff',
                color: BRAND.accent,
                borderRadius: '999px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: '700',
              },
            }),
            heading('Gear that works as hard as you do', 'top', '52px'),
            paragraph(
              'Headphones, laptops, watches and smart home kit from brands we actually use — ' +
                'delivered to your door, paid for in cash when it arrives.',
              { fontSize: '18px', maxWidth: '620px', margin: '0 auto' }
            ),
            el({
              type: 'div',
              styles: { display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '12px' },
              children: [
                button('Shop the catalog', 'shop.html'),
                button('How cash on delivery works', 'index.html#cod', 'cod', false),
              ],
            }),
          ],
          { alignItems: 'center', textAlign: 'center', gap: '20px' }
        ),
      ],
      'top',
      { paddingTop: '72px', paddingBottom: '40px', backgroundColor: BRAND.soft }
    ),

    section(
      [
        heading('Featured this week', 'featured'),
        shop('featured', { limit: 4 }),
      ],
      'featured'
    ),

    section(
      [
        wrap(
          [
            card([
              heading('Delivered when you are', 'delivery', '20px'),
              paragraph(
                'Standard delivery in 3-5 days, express in 1-2, or collect from the store in 4 hours. ' +
                  'You pick the slot that suits you at checkout.'
              ),
            ]),
            card([
              heading('Pay on delivery', 'cod', '20px'),
              paragraph(
                'Cash on delivery is available on every order. Tell the courier exactly how much to ' +
                  'collect and they will hand over the parcel — no card machine, no online payment.',
              ),
              button('Read the COD guide', 'index.html#cod', undefined, false),
            ]),
            card([
              heading('Real people, real support', 'support', '20px'),
              paragraph(
                'Order tracking, a 30-day return window and a support team that answers within one ' +
                  'business day.'
              ),
            ]),
          ],
          { flexDirection: 'row', gap: '20px', alignItems: 'stretch' }
        ),
      ],
      'how-it-works'
    ),

    section(
      [
        heading('Cash on delivery, explained', 'cod'),
        paragraph(
          'Cash on delivery (COD) is the easiest way to pay: the courier brings the parcel, you hand over ' +
            'the exact amount, and that is the end of it. Here is everything you need to know.',
          { maxWidth: '760px' }
        ),
        shop('cod-form'),
      ],
      'cod'
    ),

    section(
      [
        heading('Browse the whole catalog', 'catalog'),
        shop('grid'),
      ],
      'catalog'
    ),

    section(
      [
        heading('Frequently asked', 'faq'),
        wrap([
          faq('How long does delivery take?', 'Standard delivery is 3-5 business days, express is 1-2. Store pickup is ready in about 4 hours.'),
          faq('Can I pay the courier in cash?', 'Yes — cash on delivery is available on every order. You choose it at checkout and tell the courier how much to collect.'),
          faq('What if I am not home?', 'The courier will try twice. You can allow rescheduling at checkout, or leave a note with a safe place.'),
          faq('Do you ship internationally?', 'We ship to 20 countries. Duties are calculated at checkout before you confirm the order.'),
        ]),
      ],
      'faq'
    ),
  ]
);

const SHOP_PAGE = page(
  'Shop',
  'shop',
  'Shop all products — Northwind Electronics',
  'Browse the full catalog by category, filter by price, search and sort.',
  [
    section(
      [
        heading('Shop all', 'shop-all'),
        paragraph('Filter by category, search by name or SKU, sort by price or rating.'),
        shop('grid'),
      ],
      'shop-all'
    ),
  ]
);

const PRODUCT_PAGE = page(
  'Product',
  'product',
  'Product — Northwind Electronics',
  'Full specifications, stock and delivery options for this product.',
  [
    section(
      [
        heading('Product', 'product-top'),
        shop('product'),
      ],
      'product-top'
    ),
    section(
      [
        heading('More you might like', 'related'),
        shop('featured', { limit: 4 }),
      ],
      'related'
    ),
  ]
);

const CART_PAGE = page(
  'Cart',
  'cart',
  'Your cart — Northwind Electronics',
  'Review your basket, apply a coupon and choose a delivery speed.',
  [
    section([heading('Your cart', 'cart-top'), shop('cart')], 'cart-top'),
  ]
);

const CHECKOUT_PAGE = page(
  'Checkout',
  'checkout',
  'Checkout — Northwind Electronics',
  'Delivery details and payment. Cash on delivery is available on every order.',
  [
    section([heading('Checkout', 'checkout-top'), shop('checkout')], 'checkout-top'),
  ]
);

const CONFIRMATION_PAGE = page(
  'Order confirmation',
  'order-confirmation',
  'Order confirmation — Northwind Electronics',
  'Thank you for your order. Here is what happens next.',
  [
    section([heading('Thank you for your order', 'confirm-top'), shop('confirmation')], 'confirm-top'),
  ]
);

const TRACK_PAGE = page(
  'Track order',
  'track-order',
  'Track your order — Northwind Electronics',
  'Enter your order number and the phone number used at checkout.',
  [
    section([heading('Track your order', 'track-top'), shop('track')], 'track-top'),
  ]
);

const WISHLIST_PAGE = page(
  'Wishlist',
  'wishlist',
  'Your wishlist — Northwind Electronics',
  'Everything you saved for later.',
  [section([heading('Saved for later', 'wishlist-top'), shop('wishlist')], 'wishlist-top')]
);

const COD_PAGE = page(
  'Cash on delivery',
  'cash-on-delivery',
  'Cash on delivery — Northwind Electronics',
  'Everything about paying the courier in cash: fees, what to prepare and how it works.',
  [
    section(
      [
        heading('Pay when it arrives', 'cod-info'),
        paragraph(
          'Cash on delivery means you do not pay anything online. The courier brings the parcel, you pay ' +
            'them, and they hand it over. There is a small handling fee, shown clearly before you confirm.',
          { maxWidth: '760px' }
        ),
        shop('cod-form'),
      ],
      'cod-info'
    ),
    section(
      [
        heading('The form, field by field', 'cod-fields'),
        wrap([
          faq('Cash to collect', 'The exact amount the courier must collect, including shipping, tax and the handling fee. Edit it before you order if you want.'),
          faq('Who will pay?', 'You, the person receiving the parcel, or someone else. If it is not you, we collect their name and phone so the courier can call.'),
          faq('ID for verification', 'Optional. Some couriers ask for a national ID, passport or driving licence before handing over a cash order.'),
          faq('Instructions for the courier', 'Anything the courier should know — a gate code, a buzzer, "please call first".'),
        ]),
      ],
      'cod-fields'
    ),
  ]
);

const ABOUT_PAGE = page(
  'About',
  'about',
  'About us — Northwind Electronics',
  'Who we are, how we pick products and how our sellers work.',
  [
    section(
      [
        heading('We sell the kit we use', 'our-story'),
        paragraph(
          'Northwind started in 2021 as a two-person repair bench. We still pick every product we list by ' +
            'using it for a season first, and we drop anything that does not survive it.',
          { maxWidth: '760px' }
        ),
        shop('featured', { limit: 3 }),
      ],
      'our-story'
    ),
    section(
      [
        heading('Sellers on Northwind', 'sellers'),
        paragraph(
          'Our marketplace hosts independent sellers. Each one is verified, pays a commission on what they ' +
            'sell, and fulfils their own orders from their own panel.'
        ),
      ],
      'sellers'
    ),
  ]
);

const CONTACT_PAGE = page(
  'Contact',
  'contact',
  'Contact us — Northwind Electronics',
  'Questions about an order, a return or a product? Send us a message.',
  [
    section(
      [
        heading('Get in touch', 'contact-form'),
        paragraph('We answer every message within one business day.'),
        el({
          type: 'contact-form',
          styles: { width: '100%' },
        }),
      ],
      'contact-form'
    ),
    section(
      [
        heading('Order support', 'order-support'),
        wrap([
          faq('Where is my order?', 'Use the Track order page with your order number and phone number.'),
          faq('Can I change or cancel?', 'Yes, until the order is packed. Open the admin panel or contact support with your order number.'),
          faq('Returns', '30 days from delivery, as long as the item is in its original packaging.'),
        ]),
      ],
      'order-support'
    ),
  ]
);

const ADMIN_PAGE = page(
  'Admin',
  'admin',
  'Admin panel — Northwind Electronics',
  'Orders, products, sellers, coupons, customers and store settings.',
  [section([heading('Admin panel', 'admin-top'), shop('admin')], 'admin-top')]
);

const SELLER_PAGE = page(
  'Seller panel',
  'seller',
  'Seller panel — Northwind Electronics',
  'Listings, order fulfilment, payouts and store profile.',
  [section([heading('Seller panel', 'seller-top'), shop('seller')], 'seller-top')]
);

/* ------------------------------------------------------- nav + footer */

const NAV = (() => {
  const { elements, rootIds } = build([
    el({
      type: 'div',
      styles: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '14px 24px',
        backgroundColor: BRAND.white,
        borderBottom: `1px solid ${BRAND.line}`,
      },
      children: [
        el({
          type: 'heading',
          content: 'Northwind',
          attributes: { headingTag: 'h1', anchor: 'brand' },
          styles: { fontSize: '20px', fontWeight: '900', color: BRAND.ink, margin: '0', width: 'auto' },
        }),
        el({ type: 'site-menu', attributes: { placement: 'nav', menuClass: 'wb-menu' } }),
        el({
          type: 'html',
          content:
            '<span class="wb-cart-bar" style="display:inline-flex;align-items:center;gap:6px;' +
            'border:1px solid #e2e8f0;border-radius:999px;padding:7px 14px;font-size:13px;' +
            'font-weight:600;text-decoration:none;color:#0f172a">' +
            'Cart <span data-wb-cart-count style="display:none;background:#4f46e5;color:#fff;' +
            'border-radius:999px;padding:0 7px;font-size:11px"></span></span>',
          styles: { width: 'auto' },
        }),
      ],
    }),
  ]);
  return {
    id: 'page-_nav',
    role: 'nav' as const,
    name: 'Nav Bar',
    config: {
      title: 'Nav Bar',
      slug: '_nav',
      metaTags: {},
      globalCSS: '',
      globalJS: '',
      bodyStyles: {},
    } as PageConfig,
    elements,
    rootIds,
  };
})();

const FOOTER = (() => {
  const { elements, rootIds } = build([
    section(
      [
        wrap(
          [
            card([
              heading('Northwind Electronics', undefined, '18px'),
              paragraph('Independent gear, sold by verified sellers, delivered everywhere.'),
            ]),
            el({
              type: 'site-menu',
              attributes: { placement: 'footer', menuClass: 'wb-menu' },
            }),
          ],
          { flexDirection: 'row', gap: '24px', alignItems: 'flex-start' }
        ),
        paragraph(
          '© 2026 Northwind Electronics · Cash on delivery available · Built with WebCraft Pro',
          { fontSize: '13px', textAlign: 'center', color: BRAND.muted }
        ),
      ],
      undefined,
      { paddingTop: '40px', paddingBottom: '28px', backgroundColor: BRAND.soft, borderTop: `1px solid ${BRAND.line}` }
    ),
  ]);
  return {
    id: 'page-_footer',
    role: 'footer' as const,
    name: 'Footer',
    config: {
      title: 'Footer',
      slug: '_footer',
      metaTags: {},
      globalCSS: '',
      globalJS: '',
      bodyStyles: {},
    } as PageConfig,
    elements,
    rootIds,
  };
})();

/* --------------------------------------------------------------- links */

type LinkSpec = [label: string, kind: SiteLink['kind'], target: string, placement: SiteLink['placement']];

const LINK_SPECS: LinkSpec[] = [
  ['Home', 'page', 'page-index', ['nav', 'footer']],
  ['Shop', 'page', 'page-shop', ['nav', 'footer']],
  ['Deals', 'anchor', 'page-index#featured', ['nav']],
  ['Cash on delivery', 'page', 'page-cash-on-delivery', ['nav', 'footer']],
  ['Cart', 'page', 'page-cart', ['nav', 'footer']],
  ['Wishlist', 'page', 'page-wishlist', ['nav']],
  ['Track order', 'page', 'page-track-order', ['footer']],
  ['About', 'page', 'page-about', ['nav', 'footer']],
  ['Contact', 'page', 'page-contact', ['nav', 'footer']],
  ['FAQ', 'anchor', 'page-index#faq', ['footer']],
  ['Seller panel', 'page', 'page-seller', ['footer']],
  ['Admin', 'page', 'page-admin', ['footer']],
];

const links: SiteLink[] = LINK_SPECS.map(([label, kind, target, placement], i) => {
  const [pageId, anchor] = target.split('#');
  return {
    id: `link-${i + 1}`,
    label,
    kind,
    targetPageId: pageId,
    anchor: anchor || undefined,
    placement,
    order: i,
  };
});

/* ----------------------------------------------------------------- site */

export const STOREFRONT: SiteModel = {
  pages: [
    HOME,
    SHOP_PAGE,
    PRODUCT_PAGE,
    CART_PAGE,
    CHECKOUT_PAGE,
    CONFIRMATION_PAGE,
    TRACK_PAGE,
    WISHLIST_PAGE,
    COD_PAGE,
    ABOUT_PAGE,
    CONTACT_PAGE,
    ADMIN_PAGE,
    SELLER_PAGE,
    NAV,
    FOOTER,
  ],
  activePageId: HOME.id,
  links,
  customHTML: '',
  customCSS: `/* Store-wide tweaks written in the builder's Code tab. */
.wb-menu__link { font-weight: 600; }
.wb-menu__link.is-active { color: ${BRAND.accent}; }
.wb-product__name:hover { color: ${BRAND.accent}; }
`,
  customJS: '',
  databaseSchema: commerceSchema({ dbName: 'northwind_store', tables: [] }),
};

export const STOREFRONT_PAGES = contentPages(STOREFRONT.pages);

export const STORE_NAME = 'Northwind Electronics';

export { slugify };