<?php
/**
 * Template Name: Admin
 * Template Post Type: page
 *
 * @package northwind_electronics
 */

if (!defined('ABSPATH')) {
    exit;
}

get_header();

northwind_electronics__render_page('page-admin', northwind_electronics__pages());
?>
<?php
get_footer();
