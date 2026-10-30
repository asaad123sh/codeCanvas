const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || "northwind_store",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: false,
});

module.exports = {
  query: async (sql, params) => {
    const [rows] = await pool.execute(sql, params);
    return Array.isArray(rows) ? rows : [rows];
  },
  connect: async () => {
    await pool.query('SELECT 1');
    console.log('✔ MySQL connected');
  },
};
