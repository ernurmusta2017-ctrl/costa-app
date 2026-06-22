const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { URL } = require('url');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Configure Supabase Connection Pool with TLS SNI verification
let sslConfig = { rejectUnauthorized: false };

if (process.env.DATABASE_URL) {
  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    sslConfig.servername = dbUrl.hostname;
    console.log(`📡 Injected TLS SNI servername: ${dbUrl.hostname}`);
  } catch (parseError) {
    console.error("⚠️ Failed to parse DATABASE_URL hostname for SNI:", parseError.message);
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('⚠️ Database Connection Warning:', err.message);
  } else {
    console.log('✅ Supabase PostgreSQL Connected!');
    release();
  }
});

// --- 1. GET ALL USERS ---
app.get('/api/users', async (req, res) => {
  try {
    const query = 'SELECT user_id, first_name, last_name, email, phone_number, is_host FROM users ORDER BY user_id DESC;';
    const result = await pool.query(query);
    res.status(200).json({ success: true, users: result.rows });
  } catch (error) {
    console.error("Fetch Users Error:", error.message);
    res.status(500).json({ success: false, error: "Failed to retrieve users." });
  }
});

// --- 2. REGISTER A NEW USER ---
app.post('/api/users', async (req, res) => {
  if (req.body.test === true) {
    return res.status(200).json({ success: true, message: "Handshake payload received!" });
  }

  const { first_name, last_name, email, password_hash, phone_number, is_host } = req.body;
  try {
    const query = `
      INSERT INTO users (first_name, last_name, email, password_hash, phone_number, is_host)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING user_id, email, is_host;
    `;
    const values = [first_name, last_name, email, password_hash, phone_number, is_host || false];
    const result = await pool.query(query, values);
    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error("User Registration Error:", error.message);
    res.status(500).json({ success: false, error: "Registration failed." });
  }
});

// --- 3. GET APPROVED VILLAS ---
app.get('/api/properties', async (req, res) => {
  try {
    // Only fetch approved properties
    const query = "SELECT * FROM properties WHERE status = 'approved' ORDER BY property_id DESC;";
    const result = await pool.query(query);
    res.status(200).json({ success: true, properties: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to retrieve properties." });
  }
});

// --- 4. UPLOAD NEW VILLA (AS PENDING) ---
app.post('/api/properties', async (req, res) => {
  const { host_id, title, description, location_city, location_country, max_guests, base_price_per_night, img } = req.body;
  try {
    // Force status to 'pending'
    const query = `
      INSERT INTO properties (host_id, title, description, location_city, location_country, max_guests, base_price_per_night, img, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      RETURNING *;
    `;
    const values = [host_id, title, description, location_city, location_country, max_guests, base_price_per_night, img];
    const result = await pool.query(query, values);
    res.status(201).json({ success: true, property: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create property listing." });
  }
});

// --- 5. APPROVE PENDING VILLA (ADMIN ONLY) ---
app.post('/api/approve-property/:id', async (req, res) => {
  try {
    await pool.query("UPDATE properties SET status = 'approved' WHERE property_id = $1", [req.params.id]);
    res.status(200).json({ success: true, message: `Property ${req.params.id} approved!` });
  } catch (error) {
    res.status(500).json({ success: false, error: "Approval failed." });
  }
});

// --- ADMIN ROUTES (DASHBOARD FUNCTIONALITY) ---


// Fetch ALL properties (including pending for dashboard review)
app.get('/api/admin/properties', async (req, res) => {
  try {
    const query = "SELECT * FROM properties ORDER BY created_at DESC;";
    const result = await pool.query(query);
    res.status(200).json({ success: true, properties: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to retrieve admin properties." });
  }
});

// Delete any property listing
app.delete('/api/admin/properties/:id', async (req, res) => {
  try {
    await pool.query("DELETE FROM properties WHERE property_id = $1", [req.params.id]);
    res.status(200).json({ success: true, message: `Property ${req.params.id} deleted successfully.` });
  } catch (error) {
    res.status(500).json({ success: false, error: "Deletion failed." });
  }
});

// --- 6. HEALTH CHECK ROOT ---
app.get('/', async (req, res) => {
  try {
    await pool.query('SELECT NOW()');
    res.json({ status: "online", database: "connected" });
  } catch (err) {
    res.json({ status: "online", database: "disconnected", error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});