<?php
/**
 * Template Name: Shop
 * Template Post Type: page
 *
 * @package northwind_electronics
 */

if (!defined('ABSPATH')) {
    exit;
}

get_header();

northwind_electronics__render_page('page-shop', northwind_electronics__pages());
?>
<?php
get_footer();
