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

// 2. Add Property - UPDATED with location_country
app.post('/api/admin/properties/add', async (req, res) => {
  const { title, price, host_id, location_city, location_country, guests, image_url, description } = req.body;
  try {
    const query = `
      INSERT INTO properties (title, base_price_per_night, host_id, location_city, location_country, max_guests, image_url, description) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *`;
    const values = [title, price, host_id, location_city, location_country, guests, image_url, description];
    
    const result = await pool.query(query, values);
    res.json({ success: true, property: result.rows[0] });
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({ error: "Database insertion failed." });
  }
});

// 3. Update Property - UPDATED with location_country
app.put('/api/admin/properties/:id', async (req, res) => {
  const { title, price, location_city, location_country, guests, image_url, description } = req.body;
  try {
    await pool.query(
      `UPDATE properties SET title = $1, base_price_per_night = $2, location_city = $3, location_country = $4, max_guests = $5, image_url = $6, description = $7 
       WHERE property_id = $8`,
      [title, price, location_city, location_country, guests, image_url, description, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ error: "Update failed." });
  }
});

// 4. Auth Login
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