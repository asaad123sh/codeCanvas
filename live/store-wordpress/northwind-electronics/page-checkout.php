<?php
/**
 * Template Name: Checkout
 * Template Post Type: page
 *
 * @package northwind_electronics
 */

if (!defined('ABSPATH')) {
    exit;
}

get_header();

northwind_electronics__render_page('page-checkout', northwind_electronics__pages());
?>
<?php
get_footer();
