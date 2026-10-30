const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * Every table designed in the builder becomes a REST resource.
 * Column names are whitelisted server-side — nothing is interpolated
 * from user input.
 */
const TABLES = ["categories", "sellers", "products", "customers", "addresses", "orders", "order_items", "coupons", "reviews"];
const COLUMNS = {
  "categories": ["id", "slug", "name", "emoji"],
  "sellers": ["id", "store", "name", "email", "phone", "commission", "rating", "status", "joined"],
  "products": ["id", "sku", "slug", "name", "category_id", "seller_id", "price", "compare_at", "stock", "rating", "reviews_count", "badge", "emoji", "tint", "blurb", "description", "specs", "active", "created_at"],
  "customers": ["id", "user_id", "name", "email", "phone", "city", "created_at"],
  "addresses": ["id", "customer_id", "label", "name", "phone", "line1", "line2", "city", "state", "postal_code", "country", "is_default"],
  "orders": ["id", "order_no", "customer_id", "customer_name", "email", "phone", "line1", "line2", "city", "state", "postal_code", "country", "shipping_method", "payment_method", "cod_amount", "cod_status", "cod_collected_at", "delivery_date", "delivery_notes", "gift_wrap", "subtotal", "discount", "shipping_fee", "tax", "total", "status", "seller_notes", "created_at"],
  "order_items": ["id", "order_id", "product_id", "sku", "name", "price", "qty", "seller_id"],
  "coupons": ["code", "type", "value", "min_subtotal", "note", "max_uses", "used", "expires"],
  "reviews": ["id", "product_id", "customer_name", "rating", "title", "body", "created_at"]
};

const ident = (name) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) ? name : null;
const MAX_LIMIT = 100;

router.get('/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: "mysql" });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.get('/', (_req, res) => {
  res.json({ resources: TABLES.map((table) => '/api/' + table) });
});

TABLES.forEach((table) => {
  const columns = COLUMNS[table] || [];
  const safeTable = ident(table);
  const idColumn = columns.includes('id') ? 'id' : columns[0];

  router.get('/' + table, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || MAX_LIMIT, MAX_LIMIT);
      const offset = (Math.max(parseInt(req.query.page, 10) || 1, 1) - 1) * limit;
      const rows = await db.query(
        'SELECT * FROM ' + safeTable + ' ORDER BY ' + ident(idColumn) + ' DESC LIMIT ' + limit + ' OFFSET ' + offset
      );
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/' + table + '/:id', async (req, res) => {
    try {
      const rows = await db.query(
        'SELECT * FROM ' + safeTable + ' WHERE ' + ident(idColumn) + ' = ?',
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Not found' });
      res.json(rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/' + table, async (req, res) => {
    try {
      const keys = columns.filter((column) => req.body[column] !== undefined);
      if (!keys.length) return res.status(400).json({ error: 'No valid fields supplied' });
      const placeholders = keys.map((_key, index) => (dbType === 'mysql' ? '?' : '$' + (index + 1)));
      const values = keys.map((key) => req.body[key]);
      const rows = await db.query(
        'INSERT INTO ' + safeTable + ' (' + keys.join(', ') + ') VALUES (' + placeholders.join(', ') + ') RETURNING *',
        values
      );
      res.status(201).json(rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/' + table + '/:id', async (req, res) => {
    try {
      await db.query('DELETE FROM ' + safeTable + ' WHERE ' + ident(idColumn) + ' = ?', [req.params.id]);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

module.exports = router;
