<?php
/**
 * Fallback template - renders the home page of the generated site.
 *
 * @package northwind_electronics
 */

if (!defined('ABSPATH')) {
    exit;
}

get_header();

northwind_electronics__render_page('page-index', northwind_electronics__pages());
?>
<?php
get_footer();
