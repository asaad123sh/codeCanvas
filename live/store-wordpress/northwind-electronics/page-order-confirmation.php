<?php
/**
 * Template Name: Order confirmation
 * Template Post Type: page
 *
 * @package northwind_electronics
 */

if (!defined('ABSPATH')) {
    exit;
}

get_header();

northwind_electronics__render_page('page-order-confirmation', northwind_electronics__pages());
?>
<?php
get_footer();
