const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 1. Fetch all properties
app.get('/api/admin/properties', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM properties ORDER BY property_id DESC');
    res.json({ properties: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch properties." });
  }
});

// 2. Add Property
app.post('/api/admin/properties/add', async (req, res) => {
  const { title, price, host_id, location_city, location_country, guests, image_url, description } = req.body;
  try {
    const query = `INSERT INTO properties (title, base_price_per_night, host_id, location_city, location_country, max_guests, image_url, description, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING *`;
    const result = await pool.query(query, [title, price, host_id, location_city, location_country, guests, image_url, description]);
    res.json({ success: true, property: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Database insertion failed." });
  }
});

// 3. Approve or Reject Property
app.post('/api/admin/properties/:id/:action', async (req, res) => {
  const { id, action } = req.params;
  const status = action === 'approve' ? 'approved' : 'rejected';
  try {
    await pool.query("UPDATE properties SET status = $1 WHERE property_id = $2", [status, id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update status." });
  }
});

// 4. Calendar Booking Endpoint (Updated to match your table schema)
app.get('/api/bookings', async (req, res) => {
  try {
    const query = `
      SELECT 
        booking_id AS id, 
        'Booking #' || booking_id AS title, 
        check_in_date AS start, 
        check_out_date AS end 
      FROM bookings`;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Calendar Fetch Error:", error);
    res.status(500).json({ error: "Failed to fetch bookings." });
  }
});

// 5. Auth Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query("SELECT user_id, is_host FROM users WHERE email = $1 AND password_hash = $2", [email, password]);
    if (result.rows.length > 0) res.json({ success: true, user: result.rows[0] });
    else res.status(401).json({ success: false, message: "Invalid credentials." });
  } catch (error) {
    res.status(500).json({ success: false, error: "Database error." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));