import type { ElementDefinition, ElementType, ElementNode } from '../types';

export const ELEMENT_DEFINITIONS: ElementDefinition[] = [
  // LAYOUT
  { type: 'section', label: 'Section', icon: 'LayoutGrid', category: 'layout', hasChildren: true, defaultStyles: { display: 'flex', flexDirection: 'column', width: '100%', padding: '60px 20px', minHeight: '200px' }, attributes: { arrangement: 'vertical' } },
  { type: 'container', label: 'Container', icon: 'Box', category: 'layout', hasChildren: true, defaultStyles: { display: 'flex', width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '20px', gap: '20px' }, attributes: { arrangement: 'horizontal' } },
  { type: 'column', label: 'Column', icon: 'Columns', category: 'layout', hasChildren: true, defaultStyles: { display: 'flex', flexDirection: 'column', flex: '1', padding: '15px', minWidth: '200px' }, attributes: { arrangement: 'vertical' } },
  { type: 'grid-box', label: 'Box Container', icon: 'Grid3X3', category: 'layout', hasChildren: true, defaultStyles: { display: 'grid', gap: '20px', width: '100%', padding: '10px', '--wb-cols': 3 }, attributes: { boxPreset: 'custom', rows: 3, cols: 3, arrangement: 'vertical' } },
  // BASIC
  { type: 'heading', label: 'Heading', icon: 'Type', category: 'basic', defaultContent: 'Add Your Heading', defaultStyles: { fontSize: '42px', fontWeight: '800', color: '#1e293b', margin: '0 0 20px 0', lineHeight: '1.2' } },
  { type: 'text', label: 'Text Editor', icon: 'AlignLeft', category: 'basic', defaultContent: 'Click to edit this text.', defaultStyles: { fontSize: '16px', lineHeight: '1.7', color: '#475569', margin: '0 0 20px 0' } },
  { type: 'image', label: 'Image', icon: 'Image', category: 'basic', defaultStyles: { maxWidth: '100%', height: 'auto', borderRadius: '12px' }, attributes: { src: 'https://placehold.co/800x450/4f46e5/white?text=Image', alt: '' } },
  { type: 'button', label: 'Button', icon: 'MousePointerClick', category: 'basic', defaultContent: 'Click Me', defaultStyles: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '14px 36px', backgroundColor: '#4f46e5', color: '#ffffff', fontSize: '16px', fontWeight: '600', borderRadius: '8px', cursor: 'pointer', border: 'none' } },
  { type: 'link', label: 'Link', icon: 'Link', category: 'basic', defaultContent: 'Learn More', defaultStyles: { color: '#4f46e5', textDecoration: 'underline', fontSize: '16px', cursor: 'pointer' } },
  { type: 'video', label: 'Video', icon: 'Play', category: 'basic', defaultStyles: { width: '100%', aspectRatio: '16/9', borderRadius: '12px' }, attributes: { controls: true } },
  { type: 'spacer', label: 'Spacer', icon: 'MoveVertical', category: 'basic', defaultStyles: { height: '50px', width: '100%' } },
  { type: 'divider', label: 'Divider', icon: 'Minus', category: 'basic', defaultStyles: { width: '100%', height: '2px', backgroundColor: '#e2e8f0', margin: '30px 0' } },
  { type: 'icon', label: 'Icon', icon: 'Star', category: 'basic', defaultContent: '★', defaultStyles: { fontSize: '48px', color: '#4f46e5', display: 'inline-flex' } },
  { type: 'html', label: 'HTML', icon: 'Code', category: 'basic', defaultContent: '<div>Custom HTML</div>', defaultStyles: { width: '100%' } },
  { type: 'code-block', label: 'Code Block', icon: 'Terminal', category: 'basic', defaultContent: 'console.log("hello");', defaultStyles: { fontFamily: 'monospace', backgroundColor: '#1e293b', color: '#e2e8f0', padding: '24px', borderRadius: '12px', fontSize: '14px' } },
  // ADVANCED (Elementor Pro)
  { type: 'animated-headline', label: 'Animated Headline', icon: 'Sparkles', category: 'advanced', defaultContent: 'Amazing Website', defaultStyles: { fontSize: '48px', fontWeight: '800', color: '#1e293b', textAlign: 'center' }, attributes: { animation: 'typing' } },
  { type: 'blockquote', label: 'Blockquote', icon: 'Quote', category: 'advanced', defaultContent: '"Design is how it works." — Steve Jobs', defaultStyles: { padding: '24px 32px', borderLeft: '4px solid #4f46e5', backgroundColor: '#f8fafc', fontStyle: 'italic', fontSize: '18px', borderRadius: '0 8px 8px 0' } },
  { type: 'call-to-action', label: 'Call to Action', icon: 'Zap', category: 'advanced', hasChildren: true, defaultContent: 'Get Started Today', defaultStyles: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 40px', backgroundColor: '#4f46e5', borderRadius: '16px', textAlign: 'center', color: '#fff', minHeight: '300px' } },
  { type: 'flip-box', label: 'Flip Box', icon: 'Layers', category: 'advanced', defaultContent: 'Hover to flip', defaultStyles: { width: '300px', height: '300px', cursor: 'pointer' }, attributes: { frontTitle: 'Front', backTitle: 'Back' } },
  { type: 'countdown', label: 'Countdown', icon: 'Clock', category: 'advanced', defaultStyles: { display: 'flex', gap: '16px', justifyContent: 'center', padding: '32px', backgroundColor: '#0f172a', borderRadius: '12px' }, attributes: { dueDate: '2026-12-31T23:59:59' } },
  { type: 'hotspot', label: 'Hotspot', icon: 'MapPin', category: 'advanced', defaultStyles: { position: 'relative', width: '100%', minHeight: '400px' } },
  { type: 'lottie', label: 'Lottie', icon: 'Loader', category: 'advanced', defaultStyles: { width: '300px', height: '300px', margin: '0 auto' }, attributes: { loop: true, autoplay: true } },
  { type: 'slides', label: 'Slides', icon: 'PanelRightOpen', category: 'advanced', hasChildren: true, defaultStyles: { width: '100%', height: '400px', overflow: 'hidden', borderRadius: '12px' } },
  { type: 'progress-tracker', label: 'Progress Tracker', icon: 'Activity', category: 'advanced', defaultStyles: { width: '100%', height: '4px', backgroundColor: '#e2e8f0', position: 'sticky', top: '0', zIndex: 100 } },
  { type: 'off-canvas', label: 'Off Canvas', icon: 'PanelLeftOpen', category: 'advanced', hasChildren: true, defaultStyles: { width: '300px', height: '100vh', backgroundColor: '#ffffff', padding: '24px' } },
  { type: 'table-of-contents', label: 'Table of Contents', icon: 'ListTree', category: 'advanced', defaultStyles: { padding: '24px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' } },
  { type: 'mega-menu', label: 'Mega Menu', icon: 'Menu', category: 'advanced', hasChildren: true, defaultStyles: { display: 'flex', gap: '24px', padding: '16px 24px', backgroundColor: '#ffffff' } },
  { type: 'nested-carousel', label: 'Nested Carousel', icon: 'GalleryHorizontal', category: 'advanced', hasChildren: true, defaultStyles: { width: '100%', overflow: 'hidden', borderRadius: '12px' } },
  { type: 'floating-buttons', label: 'Floating Buttons', icon: 'MessageCircle', category: 'advanced', defaultStyles: { position: 'fixed', bottom: '24px', right: '24px', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 9998 } },
  { type: 'link-in-bio', label: 'Link in Bio', icon: 'Link', category: 'advanced', defaultStyles: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px 20px', maxWidth: '480px', backgroundColor: '#0f172a', borderRadius: '24px' } },
  { type: 'search-form', label: 'Search Form', icon: 'Search', category: 'advanced', defaultStyles: { display: 'flex', width: '100%', maxWidth: '500px' }, attributes: { placeholder: 'Search...', action: '/', method: 'get', searchField: 's' } },
  // MEDIA
  { type: 'gallery', label: 'Gallery', icon: 'Grid3X3', category: 'media', hasChildren: true, defaultStyles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', width: '100%' } },
  { type: 'map', label: 'Map', icon: 'Map', category: 'media', defaultStyles: { width: '100%', height: '400px', borderRadius: '8px' } },
  { type: 'media-carousel', label: 'Media Carousel', icon: 'PanelRightOpen', category: 'media', hasChildren: true, defaultStyles: { width: '100%', overflow: 'hidden', borderRadius: '12px' } },
  { type: 'testimonial-carousel', label: 'Testimonial Carousel', icon: 'MessageSquare', category: 'media', hasChildren: true, defaultStyles: { width: '100%', padding: '40px 20px', backgroundColor: '#f8fafc', borderRadius: '16px' } },
  { type: 'video-playlist', label: 'Video Playlist', icon: 'Play', category: 'media', defaultStyles: { width: '100%', maxWidth: '800px' } },
  { type: 'code-highlight', label: 'Code Highlight', icon: 'Terminal', category: 'media', defaultContent: 'const x = 1;', defaultStyles: { fontFamily: 'monospace', backgroundColor: '#1e1e2e', color: '#cdd6f4', padding: '24px', borderRadius: '12px', fontSize: '14px' } },
  // FORMS
  { type: 'form', label: 'Form', icon: 'FileInput', category: 'forms', hasChildren: true, defaultStyles: { display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '600px', padding: '24px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' } },
  { type: 'input', label: 'Input', icon: 'TextCursorInput', category: 'forms', defaultStyles: { width: '100%', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px' }, attributes: { type: 'text', placeholder: 'Enter text...' } },
  { type: 'textarea', label: 'Textarea', icon: 'WrapText', category: 'forms', defaultStyles: { width: '100%', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', minHeight: '120px' } },
  { type: 'select', label: 'Select', icon: 'ChevronDown', category: 'forms', defaultStyles: { width: '100%', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px' } },
  { type: 'checkbox', label: 'Checkbox', icon: 'CheckSquare', category: 'forms', defaultContent: 'Check this', defaultStyles: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' } },
  { type: 'radio', label: 'Radio', icon: 'CircleDot', category: 'forms', defaultContent: 'Option', defaultStyles: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' } },
  { type: 'login-form', label: 'Login / Register', icon: 'LogIn', category: 'forms', defaultStyles: { display: 'flex', flexDirection: 'column', gap: '16px', padding: '32px', backgroundColor: '#ffffff', borderRadius: '12px', maxWidth: '400px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }, attributes: { authMode: 'login', showRemember: true, showName: true, loginButton: 'Sign in', registerButton: 'Create account', forgotButton: 'Send reset link' } },
  { type: 'paypal-button', label: 'PayPal Button', icon: 'DollarSign', category: 'forms', defaultContent: 'Pay with PayPal', defaultStyles: { padding: '12px 24px', backgroundColor: '#ffc439', color: '#003087', fontWeight: '700', borderRadius: '25px', textAlign: 'center', cursor: 'pointer' } },
  { type: 'stripe-button', label: 'Stripe Button', icon: 'CreditCard', category: 'forms', defaultContent: 'Pay Now', defaultStyles: { padding: '12px 24px', backgroundColor: '#635bff', color: '#ffffff', fontWeight: '600', borderRadius: '8px', textAlign: 'center', cursor: 'pointer' } },
  // WIDGETS
  { type: 'nav-menu', label: 'Nav Menu', icon: 'Menu', category: 'widgets', hasChildren: true, defaultStyles: { display: 'flex', alignItems: 'center', gap: '24px', padding: '16px 24px', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0' } },
  // Renders the site-wide menu buttons (Pages menu -> Menu). Buttons are
  // managed in the builder, not as child elements.
  { type: 'site-menu', label: 'Site Menu', icon: 'Menu', category: 'widgets', defaultStyles: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }, attributes: { placement: 'nav', menuClass: 'wb-menu' } },
  // E-commerce block. `attributes.block` picks which one; the server renders the
  // catalog into the marker and the client takes over for anything that depends
  // on the visitor (cart, checkout, order pages, admin and seller panels).
  { type: 'shop-section', label: 'Store Block', icon: 'ShoppingCart', category: 'widgets', defaultStyles: { width: '100%' }, attributes: { block: 'grid' } },
  { type: 'carousel', label: 'Carousel', icon: 'PanelRightOpen', category: 'widgets', hasChildren: true, defaultStyles: { width: '100%', overflow: 'hidden', borderRadius: '12px' } },
  { type: 'tabs', label: 'Tabs', icon: 'FolderOpen', category: 'widgets', hasChildren: true, defaultStyles: { width: '100%' } },
  { type: 'accordion', label: 'Accordion', icon: 'ListCollapse', category: 'widgets', hasChildren: true, defaultStyles: { width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' } },
  { type: 'counter', label: 'Counter', icon: 'Hash', category: 'widgets', defaultContent: '1000', defaultStyles: { fontSize: '48px', fontWeight: '800', color: '#4f46e5', textAlign: 'center' } },
  { type: 'progress-bar', label: 'Progress Bar', icon: 'Battery', category: 'widgets', defaultStyles: { width: '100%', height: '12px', backgroundColor: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }, attributes: { value: 75 } },
  { type: 'testimonial', label: 'Testimonial', icon: 'Quote', category: 'widgets', defaultContent: '"Amazing product!"', defaultStyles: { padding: '32px', backgroundColor: '#f8fafc', borderRadius: '16px', fontStyle: 'italic', fontSize: '18px', color: '#334155' } },
  { type: 'pricing-table', label: 'Pricing Table', icon: 'CreditCard', category: 'widgets', hasChildren: true, defaultStyles: { display: 'flex', gap: '24px', width: '100%', justifyContent: 'center' } },
  { type: 'price-list', label: 'Price List', icon: 'List', category: 'widgets', defaultStyles: { width: '100%', padding: '20px' } },
  { type: 'social-icons', label: 'Social Icons', icon: 'Share2', category: 'widgets', defaultStyles: { display: 'flex', gap: '12px' } },
  { type: 'share-buttons', label: 'Share Buttons', icon: 'Share2', category: 'widgets', defaultStyles: { display: 'flex', gap: '8px' } },
  // THEME
  { type: 'author-box', label: 'Author Box', icon: 'User', category: 'theme', defaultStyles: { display: 'flex', gap: '16px', padding: '24px', backgroundColor: '#f8fafc', borderRadius: '12px' } },
  { type: 'breadcrumbs', label: 'Breadcrumbs', icon: 'ChevronRight', category: 'theme', defaultContent: 'Home > Page', defaultStyles: { fontSize: '14px', color: '#64748b' } },
  { type: 'post-info', label: 'Post Info', icon: 'Info', category: 'theme', defaultContent: 'Jan 1, 2026 by Admin', defaultStyles: { fontSize: '13px', color: '#94a3b8' } },
  { type: 'post-navigation', label: 'Post Navigation', icon: 'ArrowLeftRight', category: 'theme', defaultStyles: { display: 'flex', justifyContent: 'space-between', padding: '16px 0' } },
  { type: 'sitemap', label: 'Sitemap', icon: 'ListTree', category: 'theme', hasChildren: true, defaultStyles: { padding: '20px' } },
  { type: 'loop-grid', label: 'Loop Grid', icon: 'Grid3X3', category: 'theme', hasChildren: true, defaultStyles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' } },
  { type: 'loop-carousel', label: 'Loop Carousel', icon: 'PanelRightOpen', category: 'theme', hasChildren: true, defaultStyles: { width: '100%', overflow: 'hidden' } },
  { type: 'taxonomy-filter', label: 'Taxonomy Filter', icon: 'Filter', category: 'theme', defaultStyles: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
  { type: 'posts', label: 'Posts', icon: 'Newspaper', category: 'theme', hasChildren: true, defaultStyles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' } },
  { type: 'portfolio', label: 'Portfolio', icon: 'Briefcase', category: 'theme', hasChildren: true, defaultStyles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } },
  { type: 'archive-posts', label: 'Archive Posts', icon: 'Archive', category: 'theme', hasChildren: true, defaultStyles: { display: 'flex', flexDirection: 'column', gap: '24px' } },
  { type: 'archive-title', label: 'Archive Title', icon: 'Type', category: 'theme', defaultContent: 'Archive', defaultStyles: { fontSize: '36px', fontWeight: '700' } },
  { type: 'page-title', label: 'Page Title', icon: 'Type', category: 'theme', defaultContent: 'Page Title', defaultStyles: { fontSize: '42px', fontWeight: '800' } },
  { type: 'post-content', label: 'Post Content', icon: 'FileText', category: 'theme', defaultContent: 'Lorem ipsum dolor sit amet.', defaultStyles: { fontSize: '16px', lineHeight: '1.8', color: '#334155' } },
  { type: 'post-excerpt', label: 'Post Excerpt', icon: 'Scissors', category: 'theme', defaultContent: 'Short excerpt...', defaultStyles: { fontSize: '15px', color: '#64748b' } },
  { type: 'post-featured-image', label: 'Featured Image', icon: 'Image', category: 'theme', defaultStyles: { width: '100%', borderRadius: '12px' }, attributes: { src: 'https://placehold.co/1200x600/4f46e5/white?text=Featured' } },
  { type: 'post-title', label: 'Post Title', icon: 'Type', category: 'theme', defaultContent: 'Post Title', defaultStyles: { fontSize: '28px', fontWeight: '700' } },
  { type: 'site-logo', label: 'Site Logo', icon: 'Image', category: 'theme', defaultStyles: { maxWidth: '200px' }, attributes: { src: 'https://placehold.co/200x60/1e293b/white?text=Logo' } },
  { type: 'site-title', label: 'Site Title', icon: 'Globe', category: 'theme', defaultContent: 'My Website', defaultStyles: { fontSize: '24px', fontWeight: '700' } },
  { type: 'post-comments', label: 'Comments', icon: 'MessageCircle', category: 'theme', defaultStyles: { padding: '24px', backgroundColor: '#f8fafc', borderRadius: '12px' } },
  { type: 'global-widget', label: 'Global Widget', icon: 'Globe', category: 'theme', defaultContent: 'Global Widget' },
  { type: 'template', label: 'Template', icon: 'FileText', category: 'theme', defaultContent: 'Saved Template' },
  // WOOCOMMERCE
  { type: 'woo-cart', label: 'Cart', icon: 'ShoppingCart', category: 'woocommerce', defaultStyles: { width: '100%', padding: '20px' } },
  { type: 'woo-checkout', label: 'Checkout', icon: 'CreditCard', category: 'woocommerce', defaultStyles: { width: '100%', padding: '20px' } },
  { type: 'woo-products', label: 'Products', icon: 'Package', category: 'woocommerce', hasChildren: true, defaultStyles: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' } },
  { type: 'woo-add-to-cart', label: 'Add to Cart', icon: 'ShoppingCart', category: 'woocommerce', defaultContent: 'Add to Cart', defaultStyles: { padding: '12px 24px', backgroundColor: '#4f46e5', color: '#fff', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' } },
  { type: 'woo-categories', label: 'Categories', icon: 'Grid3X3', category: 'woocommerce', hasChildren: true, defaultStyles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' } },
  { type: 'woo-menu-cart', label: 'Menu Cart', icon: 'ShoppingCart', category: 'woocommerce', defaultContent: '🛒 0', defaultStyles: { fontSize: '16px', cursor: 'pointer' } },
  { type: 'woo-my-account', label: 'My Account', icon: 'User', category: 'woocommerce', defaultStyles: { width: '100%', padding: '20px' } },
  { type: 'woo-product-price', label: 'Price', icon: 'DollarSign', category: 'woocommerce', defaultContent: '$99.00', defaultStyles: { fontSize: '24px', fontWeight: '700' } },
  { type: 'woo-product-rating', label: 'Rating', icon: 'Star', category: 'woocommerce', defaultContent: '★★★★★', defaultStyles: { fontSize: '16px', color: '#f59e0b' } },
  { type: 'woo-product-images', label: 'Product Images', icon: 'Image', category: 'woocommerce', defaultStyles: { width: '100%', borderRadius: '12px' } },
  { type: 'woo-product-meta', label: 'Product Meta', icon: 'Tag', category: 'woocommerce', defaultContent: 'SKU: WP-001', defaultStyles: { fontSize: '13px', color: '#64748b' } },
  { type: 'woo-product-related', label: 'Related Products', icon: 'Package', category: 'woocommerce', hasChildren: true, defaultStyles: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' } },
  { type: 'woo-product-tabs', label: 'Product Tabs', icon: 'FolderOpen', category: 'woocommerce', hasChildren: true, defaultStyles: { width: '100%' } },
  { type: 'woo-breadcrumb', label: 'WC Breadcrumb', icon: 'ChevronRight', category: 'woocommerce', defaultContent: 'Shop > Product', defaultStyles: { fontSize: '13px', color: '#94a3b8' } },
  { type: 'woo-archive-desc', label: 'Archive Desc', icon: 'FileText', category: 'woocommerce', defaultContent: 'Browse products.', defaultStyles: { fontSize: '15px', color: '#475569' } },
  { type: 'woo-notices', label: 'WC Notices', icon: 'Bell', category: 'woocommerce', defaultStyles: { padding: '12px 16px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#065f46' } },
  // SOCIAL
  { type: 'facebook-button', label: 'FB Button', icon: 'ThumbsUp', category: 'social', defaultContent: 'Like', defaultStyles: { padding: '8px 16px', backgroundColor: '#1877f2', color: '#fff', borderRadius: '6px', fontWeight: '600' } },
  // ADS / ANALYTICS — raw third-party script (Google AdSense, local snippets, …)
  { type: 'ads', label: 'Ads', icon: 'Monitor', category: 'advanced', hasChildren: false, defaultStyles: { width: '100%', minHeight: '120px', backgroundColor: '#f1f5f9', borderRadius: '10px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }, attributes: { provider: 'google-adsense', scriptCode: '' } },
  // REELS — vertical short-video strip managed as its own section
  { type: 'reels-section', label: 'Reels Section', icon: 'Video', category: 'media', hasChildren: false, defaultStyles: { width: '100%', backgroundColor: '#0f172a', color: '#ffffff', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }, attributes: { aspectRatio: '9/16', showDots: true, autoplay: true, caption: '' } },
  { type: 'facebook-comments', label: 'FB Comments', icon: 'MessageCircle', category: 'social', defaultStyles: { width: '100%', minHeight: '200px', backgroundColor: '#f8fafc', borderRadius: '8px', padding: '16px' } },
  { type: 'facebook-embed', label: 'FB Embed', icon: 'Frame', category: 'social', defaultStyles: { width: '100%', minHeight: '300px', backgroundColor: '#f0f2f5', borderRadius: '8px' } },
  { type: 'facebook-page', label: 'FB Page', icon: 'BookOpen', category: 'social', defaultStyles: { width: '340px', minHeight: '130px', backgroundColor: '#ffffff', border: '1px solid #ddd', borderRadius: '8px' } },
];

export const ELEMENT_CATEGORIES = [
  { id: 'layout', label: 'Layout', icon: 'LayoutGrid' },
  { id: 'basic', label: 'Basic', icon: 'Box' },
  { id: 'advanced', label: 'Advanced', icon: 'Zap' },
  { id: 'media', label: 'Media', icon: 'Image' },
  { id: 'forms', label: 'Forms', icon: 'FileInput' },
  { id: 'widgets', label: 'Widgets', icon: 'Sparkles' },
  { id: 'theme', label: 'Theme Builder', icon: 'Globe' },
  { id: 'woocommerce', label: 'WooCommerce', icon: 'ShoppingCart' },
  { id: 'social', label: 'Social', icon: 'Share2' },
] as const;

export function getElementDefinition(type: ElementType): ElementDefinition | undefined {
  return ELEMENT_DEFINITIONS.find(d => d.type === type);
}

export function createDefaultElement(type: ElementType): Partial<ElementNode> {
  const def = getElementDefinition(type);
  return {
    type,
    label: def?.label || type,
    styles: def?.defaultStyles || {},
    content: def?.defaultContent || '',
    attributes: def?.attributes ? { ...def.attributes } : {},
    children: [],
  };
}