/**
 * E-commerce data model + seed catalog.
 *
 * One source of truth for every runtime: the SQL export, the PHP store, the
 * Node store, the WordPress store and the builder preview all read the same
 * product rows and the same status vocabulary, so a price shown in the catalog
 * is the price the order is created with.
 */

import type { DatabaseSchema, DBColumn, DBTable } from '../types';

export type Product = {
  sku: string;
  slug: string;
  name: string;
  category: string;
  seller: string;
  price: number;
  compareAt: number;
  stock: number;
  rating: number;
  reviews: number;
  badge: string;
  emoji: string;
  tint: string;
  blurb: string;
  specs: Record<string, string>;
  active: boolean;
};

export type Seller = {
  id: string;
  name: string;
  store: string;
  email: string;
  phone: string;
  commission: number;
  rating: number;
  status: 'active' | 'pending' | 'suspended';
  joined: string;
};

export type Category = { slug: string; name: string; emoji: string };

/* ------------------------------------------------------------------ *
 * Status vocabulary - shared by the client, the Node store and PHP.
 * ------------------------------------------------------------------ */

export const ORDER_STATUSES = [
  { id: 'pending', label: 'Pending', color: '#f59e0b', next: ['confirmed', 'cancelled'] },
  { id: 'confirmed', label: 'Confirmed', color: '#3b82f6', next: ['packed', 'cancelled'] },
  { id: 'packed', label: 'Packed', color: '#8b5cf6', next: ['shipped', 'cancelled'] },
  { id: 'shipped', label: 'Shipped', color: '#06b6d4', next: ['out_for_delivery'] },
  { id: 'out_for_delivery', label: 'Out for delivery', color: '#6366f1', next: ['delivered'] },
  { id: 'delivered', label: 'Delivered', color: '#22c55e', next: [] },
  { id: 'cancelled', label: 'Cancelled', color: '#ef4444', next: [] },
  { id: 'returned', label: 'Returned', color: '#a855f7', next: ['refunded'] },
  { id: 'refunded', label: 'Refunded', color: '#64748b', next: [] },
] as const;

export const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  ORDER_STATUSES.map((s) => [s.id, s.label])
);

export const COD_STATUSES = [
  { id: 'pending', label: 'Not collected' },
  { id: 'in_transit', label: 'With courier' },
  { id: 'collected', label: 'Cash collected' },
  { id: 'failed', label: 'Collection failed' },
  { id: 'waived', label: 'Waived' },
] as const;

/** Delivery windows in days offered at checkout. */
export const SHIPPING_METHODS = [
  { id: 'standard', label: 'Standard delivery', fee: 4.99, days: '3-5 business days', emoji: '🚚' },
  { id: 'express', label: 'Express delivery', fee: 12.99, days: '1-2 business days', emoji: '⚡' },
  { id: 'pickup', label: 'Store pickup', fee: 0, days: 'Ready in 4 hours', emoji: '🏬' },
] as const;

export const PAYMENT_METHODS = [
  {
    id: 'cod',
    label: 'Cash on Delivery',
    short: 'COD',
    emoji: '💵',
    hint: 'Pay the courier in cash when your order arrives.',
  },
  { id: 'card', label: 'Credit / Debit card', short: 'Card', emoji: '💳', hint: 'Visa, Mastercard, Amex.' },
  { id: 'paypal', label: 'PayPal', short: 'PayPal', emoji: '🅿️', hint: 'Redirects to PayPal.' },
  { id: 'bank', label: 'Bank transfer', short: 'Bank', emoji: '🏦', hint: 'Transfer details appear after ordering.' },
] as const;

/** Labels for the store blocks a `Store Block` widget can be switched to. */
export const SHOP_BLOCK_TITLES: Record<string, string> = {
  grid: 'Product catalog (with filters, search and sorting)',
  featured: 'Featured products',
  product: 'Product detail',
  cart: 'Cart',
  checkout: 'Checkout with the cash-on-delivery form',
  'cod-form': 'Cash on delivery information form',
  confirmation: 'Order confirmation',
  track: 'Track an order',
  wishlist: 'Wishlist',
  reviews: 'Product reviews',
  admin: 'Admin panel',
  seller: 'Seller panel',
};

export const COUPONS = [
  { code: 'WELCOME10', type: 'percent', value: 10, min: 0, note: '10% off your first order' },
  { code: 'SAVE20', type: 'fixed', value: 20, min: 100, note: '$20 off orders over $100' },
  { code: 'FREESHIP', type: 'shipping', value: 0, min: 60, note: 'Free standard shipping' },
] as const;

/* ------------------------------------------------------------------ *
 * Seed catalog
 * ------------------------------------------------------------------ */

export const CATEGORIES: Category[] = [
  { slug: 'audio', name: 'Audio', emoji: '🎧' },
  { slug: 'wearables', name: 'Wearables', emoji: '⌚' },
  { slug: 'computing', name: 'Computing', emoji: '💻' },
  { slug: 'smart-home', name: 'Smart Home', emoji: '🏠' },
  { slug: 'accessories', name: 'Accessories', emoji: '🎒' },
  { slug: 'gaming', name: 'Gaming', emoji: '🎮' },
];

export const SELLERS: Seller[] = [
  {
    id: 'sel-nova',
    name: 'Nova Audio Labs',
    store: 'Nova Audio Official Store',
    email: 'sales@novaaudio.test',
    phone: '+1 555 0101',
    commission: 12,
    rating: 4.8,
    status: 'active',
    joined: '2024-02-11',
  },
  {
    id: 'sel-pixel',
    name: 'Pixel Forge',
    store: 'Pixel Forge Direct',
    email: 'hello@pixelforge.test',
    phone: '+1 555 0102',
    commission: 15,
    rating: 4.6,
    status: 'active',
    joined: '2024-06-03',
  },
  {
    id: 'sel-lumen',
    name: 'Lumen Living',
    store: 'Lumen Smart Living',
    email: 'care@lumenliving.test',
    phone: '+1 555 0103',
    commission: 10,
    rating: 4.4,
    status: 'active',
    joined: '2025-01-20',
  },
  {
    id: 'sel-volt',
    name: 'Volt Supply Co.',
    store: 'Volt Supply',
    email: 'ops@voltsupply.test',
    phone: '+1 555 0104',
    commission: 18,
    rating: 4.1,
    status: 'pending',
    joined: '2025-09-08',
  },
];

export const PRODUCTS: Product[] = [
  {
    sku: 'NV-HP900',
    slug: 'nova-hp900-wireless-headphones',
    name: 'Nova HP-900 Wireless Headphones',
    category: 'audio',
    seller: 'sel-nova',
    price: 249,
    compareAt: 329,
    stock: 42,
    rating: 4.8,
    reviews: 1284,
    badge: 'Best seller',
    emoji: '🎧',
    tint: '#eef2ff',
    blurb: 'Hybrid ANC, 60-hour battery and multipoint pairing across three devices.',
    specs: {
      'Driver size': '40 mm dynamic',
      Battery: '60 h (ANC on)',
      Connectivity: 'Bluetooth 5.3, USB-C, 3.5 mm',
      'Water resistance': 'IPX4',
      Weight: '254 g',
    },
    active: true,
  },
  {
    sku: 'NV-EB22',
    slug: 'nova-eb22-earbuds',
    name: 'Nova EB-22 True Wireless Earbuds',
    category: 'audio',
    seller: 'sel-nova',
    price: 99,
    compareAt: 139,
    stock: 120,
    rating: 4.6,
    reviews: 2310,
    badge: 'Sale',
    emoji: '🎵',
    tint: '#fdf2f8',
    blurb: 'Pocket-sized buds with transparency mode and a wireless charging case.',
    specs: {
      'Driver size': '11 mm dynamic',
      Battery: '8 h + 24 h case',
      'Water resistance': 'IPX5',
      'Charging': 'USB-C + Qi wireless',
    },
    active: true,
  },
  {
    sku: 'PF-SB14',
    slug: 'pixel-forge-slate-14',
    name: 'Pixel Forge Slate 14 Laptop',
    category: 'computing',
    seller: 'sel-pixel',
    price: 1199,
    compareAt: 1399,
    stock: 12,
    rating: 4.7,
    reviews: 486,
    badge: 'Top rated',
    emoji: '💻',
    tint: '#f1f5f9',
    blurb: '14-inch 2.8K OLED, 32 GB RAM, 1 TB NVMe and a 12-hour battery.',
    specs: {
      Display: '14" 2880x1800 OLED 120 Hz',
      'CPU / GPU': 'Octa-core / integrated',
      Memory: '32 GB LPDDR5',
      Storage: '1 TB NVMe SSD',
      Weight: '1.28 kg',
    },
    active: true,
  },
  {
    sku: 'PF-MK75',
    slug: 'pixel-forge-mech-75-keyboard',
    name: 'Pixel Forge Mech 75 Keyboard',
    category: 'accessories',
    seller: 'sel-pixel',
    price: 139,
    compareAt: 0,
    stock: 64,
    rating: 4.5,
    reviews: 902,
    badge: 'New',
    emoji: '⌨️',
    tint: '#ecfeff',
    blurb: 'Hot-swappable 75% board with gasket mount, RGB and QMK support.',
    specs: {
      Layout: '75% (82 keys)',
      Switches: 'Hot-swap, pre-lubed linear',
      'Backlight': 'Per-key RGB',
      Connectivity: 'USB-C, 2.4 GHz, Bluetooth',
    },
    active: true,
  },
  {
    sku: 'PF-MS2',
    slug: 'pixel-forge-mouse-s2',
    name: 'Pixel Forge Mouse S2 Wireless',
    category: 'accessories',
    seller: 'sel-pixel',
    price: 79,
    compareAt: 99,
    stock: 88,
    rating: 4.4,
    reviews: 1510,
    badge: '',
    emoji: '🖱️',
    tint: '#f5f3ff',
    blurb: '58 g ultralight shell, 26K DPI sensor and 90-hour battery.',
    specs: {
      Sensor: '26,000 DPI',
      Weight: '58 g',
      Battery: '90 h',
      Connectivity: '2.4 GHz, USB-C, Bluetooth',
    },
    active: true,
  },
  {
    sku: 'PF-STR3',
    slug: 'pixel-forge-stream-cam-3',
    name: 'Pixel Forge Stream Cam 3',
    category: 'computing',
    seller: 'sel-pixel',
    price: 189,
    compareAt: 0,
    stock: 26,
    rating: 4.3,
    reviews: 342,
    badge: '',
    emoji: '📷',
    tint: '#fef2f2',
    blurb: '4K60 webcam with autofocus, dual mics and a privacy shutter.',
    specs: {
      Resolution: '4K60 / 1080p120',
      Sensor: 'Sony 1/2.3" CMOS',
      Microphones: 'Dual beamforming',
      Mount: 'Tripod + monitor clip',
    },
    active: true,
  },
  {
    sku: 'LM-BULB4',
    slug: 'lumen-bulb-pack-4',
    name: 'Lumen Smart Bulb 4-Pack',
    category: 'smart-home',
    seller: 'sel-lumen',
    price: 59,
    compareAt: 79,
    stock: 210,
    rating: 4.2,
    reviews: 2770,
    badge: 'Sale',
    emoji: '💡',
    tint: '#fffbeb',
    blurb: '16M colours, Matter support and no hub needed.',
    specs: {
      Fitting: 'E26 / E27',
      Power: '9 W LED (800 lm)',
      Protocol: 'Matter, Wi-Fi 2.4 GHz',
      App: 'iOS and Android',
    },
    active: true,
  },
  {
    sku: 'LM-CAM2',
    slug: 'lumen-cam-2',
    name: 'Lumen Indoor Cam 2 (2-Pack)',
    category: 'smart-home',
    seller: 'sel-lumen',
    price: 129,
    compareAt: 0,
    stock: 54,
    rating: 4.5,
    reviews: 818,
    badge: 'New',
    emoji: '📽️',
    tint: '#f0fdfa',
    blurb: '2K indoor cameras with pet detection and local microSD storage.',
    specs: {
      Resolution: '2K 2560x1440',
      'Field of view': '135°',
      Storage: 'MicroSD up to 256 GB',
      Power: 'USB-C',
    },
    active: true,
  },
  {
    sku: 'LM-HUB1',
    slug: 'lumen-hub-mini',
    name: 'Lumen Hub Mini',
    category: 'smart-home',
    seller: 'sel-lumen',
    price: 49,
    compareAt: 0,
    stock: 7,
    rating: 4.1,
    reviews: 402,
    badge: 'Low stock',
    emoji: '🛰️',
    tint: '#f8fafc',
    blurb: 'Compact Matter hub for Zigbee devices and scenes.',
    specs: {
      Radios: 'Zigbee 3.0, Thread',
      Power: 'USB-C',
      App: 'Lumen Home',
      'Max devices': '128',
    },
    active: true,
  },
  {
    sku: 'NV-WT7',
    slug: 'nova-watch-gt7',
    name: 'Nova Watch GT7',
    category: 'wearables',
    seller: 'sel-nova',
    price: 329,
    compareAt: 379,
    stock: 33,
    rating: 4.6,
    reviews: 1150,
    badge: 'Best seller',
    emoji: '⌚',
    tint: '#fdf4ff',
    blurb: 'AMOLED fitness watch with SpO2, GPS and 14-day battery.',
    specs: {
      Display: '1.43" AMOLED',
      Battery: '14 days typical',
      Sensors: 'HR, SpO2, GPS, compass',
      'Water resistance': '5 ATM',
    },
    active: true,
  },
  {
    sku: 'PF-PAD9',
    slug: 'pixel-forge-gamepad-9',
    name: 'Pixel Forge Gamepad 9',
    category: 'gaming',
    seller: 'sel-pixel',
    price: 69,
    compareAt: 89,
    stock: 145,
    rating: 4.5,
    reviews: 3320,
    badge: 'Sale',
    emoji: '🎮',
    tint: '#faf5ff',
    blurb: 'Hall-effect sticks, 1000 Hz polling and back paddles.',
    specs: {
      Polling: '1000 Hz wired',
      Sticks: 'Hall effect, drift-free',
      Connectivity: 'USB-C, 2.4 GHz, BT',
      Battery: '22 h',
    },
    active: true,
  },
  {
    sku: 'LM-SENSE1',
    slug: 'lumen-sense-kit',
    name: 'Lumen Sense Kit',
    category: 'smart-home',
    seller: 'sel-lumen',
    price: 39,
    compareAt: 0,
    stock: 96,
    rating: 4.0,
    reviews: 512,
    badge: '',
    emoji: '🌡️',
    tint: '#eff6ff',
    blurb: 'Motion, door, temperature and humidity sensors in one box.',
    specs: {
      Includes: 'Motion, door, temp, hub sensor',
      Battery: '2 x CR123 (2 years)',
      Range: '30 m',
      Protocol: 'Zigbee 3.0',
    },
    active: true,
  },
];

/* ------------------------------------------------------------------ *
 * Database schema
 * ------------------------------------------------------------------ */

const col = (name: string, type: string, extra: Partial<DBColumn> = {}): DBColumn => ({
  name,
  type,
  ...extra,
});

export const COMMERCE_TABLES: DBTable[] = [
  {
    name: 'categories',
    columns: [
      col('id', 'INT', { primaryKey: true, autoIncrement: true }),
      col('slug', 'VARCHAR(80)', { unique: true }),
      col('name', 'VARCHAR(120)'),
      col('emoji', 'VARCHAR(8)'),
    ],
  },
  {
    name: 'sellers',
    columns: [
      col('id', 'VARCHAR(40)', { primaryKey: true }),
      col('store', 'VARCHAR(140)'),
      col('name', 'VARCHAR(120)'),
      col('email', 'VARCHAR(160)'),
      col('phone', 'VARCHAR(40)'),
      col('commission', 'DECIMAL(5,2)'),
      col('rating', 'DECIMAL(2,1)'),
      col('status', 'VARCHAR(20)'),
      col('joined', 'DATE'),
    ],
  },
  {
    name: 'products',
    columns: [
      col('id', 'INT', { primaryKey: true, autoIncrement: true }),
      col('sku', 'VARCHAR(40)', { unique: true }),
      col('slug', 'VARCHAR(140)', { unique: true }),
      col('name', 'VARCHAR(200)'),
      col('category_id', 'INT'),
      col('seller_id', 'VARCHAR(40)'),
      col('price', 'DECIMAL(10,2)'),
      col('compare_at', 'DECIMAL(10,2)'),
      col('stock', 'INT'),
      col('rating', 'DECIMAL(2,1)'),
      col('reviews_count', 'INT'),
      col('badge', 'VARCHAR(40)'),
      col('emoji', 'VARCHAR(8)'),
      col('tint', 'VARCHAR(16)'),
      col('blurb', 'VARCHAR(400)'),
      col('description', 'TEXT'),
      col('specs', 'TEXT'),
      col('active', 'TINYINT'),
      col('created_at', 'DATETIME'),
    ],
  },
  {
    name: 'customers',
    columns: [
      col('id', 'INT', { primaryKey: true, autoIncrement: true }),
      col('user_id', 'INT'),
      col('name', 'VARCHAR(140)'),
      col('email', 'VARCHAR(160)'),
      col('phone', 'VARCHAR(40)'),
      col('city', 'VARCHAR(80)'),
      col('created_at', 'DATETIME'),
    ],
  },
  {
    name: 'addresses',
    columns: [
      col('id', 'INT', { primaryKey: true, autoIncrement: true }),
      col('customer_id', 'INT'),
      col('label', 'VARCHAR(40)'),
      col('name', 'VARCHAR(140)'),
      col('phone', 'VARCHAR(40)'),
      col('line1', 'VARCHAR(200)'),
      col('line2', 'VARCHAR(200)'),
      col('city', 'VARCHAR(80)'),
      col('state', 'VARCHAR(80)'),
      col('postal_code', 'VARCHAR(24)'),
      col('country', 'VARCHAR(80)'),
      col('is_default', 'TINYINT'),
    ],
  },
  {
    name: 'orders',
    columns: [
      col('id', 'INT', { primaryKey: true, autoIncrement: true }),
      col('order_no', 'VARCHAR(24)', { unique: true }),
      col('customer_id', 'INT'),
      col('customer_name', 'VARCHAR(140)'),
      col('email', 'VARCHAR(160)'),
      col('phone', 'VARCHAR(40)'),
      col('line1', 'VARCHAR(200)'),
      col('line2', 'VARCHAR(200)'),
      col('city', 'VARCHAR(80)'),
      col('state', 'VARCHAR(80)'),
      col('postal_code', 'VARCHAR(24)'),
      col('country', 'VARCHAR(80)'),
      col('shipping_method', 'VARCHAR(30)'),
      col('payment_method', 'VARCHAR(30)'),
      col('cod_amount', 'DECIMAL(10,2)'),
      col('cod_status', 'VARCHAR(24)'),
      col('cod_collected_at', 'DATETIME'),
      col('delivery_date', 'DATE'),
      col('delivery_notes', 'VARCHAR(400)'),
      col('gift_wrap', 'TINYINT'),
      col('subtotal', 'DECIMAL(10,2)'),
      col('discount', 'DECIMAL(10,2)'),
      col('shipping_fee', 'DECIMAL(10,2)'),
      col('tax', 'DECIMAL(10,2)'),
      col('total', 'DECIMAL(10,2)'),
      col('status', 'VARCHAR(30)'),
      col('seller_notes', 'VARCHAR(400)'),
      col('created_at', 'DATETIME'),
    ],
  },
  {
    name: 'order_items',
    columns: [
      col('id', 'INT', { primaryKey: true, autoIncrement: true }),
      col('order_id', 'INT'),
      col('product_id', 'INT'),
      col('sku', 'VARCHAR(40)'),
      col('name', 'VARCHAR(200)'),
      col('price', 'DECIMAL(10,2)'),
      col('qty', 'INT'),
      col('seller_id', 'VARCHAR(40)'),
    ],
  },
  {
    name: 'coupons',
    columns: [
      col('code', 'VARCHAR(32)', { primaryKey: true }),
      col('type', 'VARCHAR(20)'),
      col('value', 'DECIMAL(10,2)'),
      col('min_subtotal', 'DECIMAL(10,2)'),
      col('note', 'VARCHAR(160)'),
      col('max_uses', 'INT'),
      col('used', 'INT'),
      col('expires', 'DATE'),
    ],
  },
  {
    name: 'reviews',
    columns: [
      col('id', 'INT', { primaryKey: true, autoIncrement: true }),
      col('product_id', 'INT'),
      col('customer_name', 'VARCHAR(120)'),
      col('rating', 'TINYINT'),
      col('title', 'VARCHAR(160)'),
      col('body', 'TEXT'),
      col('created_at', 'DATETIME'),
    ],
  },
];

/** Full schema (site-wide tables + commerce tables) for the storefront export. */
export function commerceSchema(base: DatabaseSchema): DatabaseSchema {
  const names = new Set((base?.tables || []).map((t) => t.name));
  return {
    dbName: base?.dbName || 'store_db',
    tables: [...(base?.tables || []), ...COMMERCE_TABLES.filter((t) => !names.has(t.name))],
  };
}

/** Settings every runtime agrees on (the admin panel edits these). */
export const DEFAULT_SETTINGS = {
  storeName: 'Northwind Electronics',
  tagline: 'Gear that works as hard as you do',
  currency: '$',
  taxRate: 5,
  freeShippingOver: 150,
  codEnabled: true,
  codFee: 2.5,
  codNote: 'Please keep the exact amount ready - the courier cannot provide change.',
  currencyCode: 'USD',
  lowStockAt: 10,
} as const;

/** Seed rows serialised once and embedded in every generated runtime. */
export function seedJSON(): string {
  return JSON.stringify({
    categories: CATEGORIES,
    sellers: SELLERS,
    products: PRODUCTS,
    coupons: COUPONS,
    shipping: SHIPPING_METHODS,
    payments: PAYMENT_METHODS,
    settings: DEFAULT_SETTINGS,
    statuses: ORDER_STATUSES,
  });
}