<?php
/**
 * Template Name: Contact
 * Template Post Type: page
 *
 * @package northwind_electronics
 */

if (!defined('ABSPATH')) {
    exit;
}

get_header();

northwind_electronics__render_page('page-contact', northwind_electronics__pages());
?>
<?php
get_footer();
