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

// 2. Add Property (Status column removed)
app.post('/api/admin/properties/add', async (req, res) => {
  const { title, price, host_id, location, guests, image_url, description } = req.body;
  try {
    const query = `
      INSERT INTO properties (title, base_price_per_night, host_id, location_city, max_guests, image_url, description) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *`;
    const values = [title, price, host_id, location, guests, image_url, description];
    
    const result = await pool.query(query, values);
    res.json({ success: true, property: result.rows[0] });
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({ error: "Database insertion failed." });
  }
});

// 3. Update Property (Status column removed)
app.put('/api/admin/properties/:id', async (req, res) => {
  const { title, price, location, guests, image_url, description } = req.body;
  try {
    await pool.query(
      `UPDATE properties SET title = $1, base_price_per_night = $2, location_city = $3, max_guests = $4, image_url = $5, description = $6 
       WHERE property_id = $7`,
      [title, price, location, guests, image_url, description, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Update failed." });
  }
});

// 4. Status Management (Note: These will fail if no status column exists in DB)
// If you do not have a 'status' column in your database, please remove these two routes.
app.post('/api/admin/properties/:id/approve', async (req, res) => {
    res.status(400).json({ error: "Status column does not exist in database." });
});

app.post('/api/admin/properties/:id/reject', async (req, res) => {
    res.status(400).json({ error: "Status column does not exist in database." });
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