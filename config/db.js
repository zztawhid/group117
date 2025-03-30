const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Chicken123',
  database: process.env.DB_NAME || 'ParkingManagementSystem',
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;