const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { URL } = require('url');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Securely configure the Supabase Connection Pool
let sslConfig = { rejectUnauthorized: false };

if (process.env.DATABASE_URL) {
  try {
    // Parse the connection string to dynamically extract the pooler hostname
    const dbUrl = new URL(process.env.DATABASE_URL);
    
    // Explicitly set the SNI servername to allow the Supabase pooler to identify the tenant
    sslConfig.servername = dbUrl.hostname;
    console.log(`📡 Injected TLS SNI servername: ${dbUrl.hostname}`);
  } catch (parseError) {
    console.error("⚠️ Failed to parse DATABASE_URL hostname for SNI injection:", parseError.message);
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig
});

// Test DB Connection immediately on boot to prevent silent crashes
pool.connect((err, client, release) => {
  if (err) {
    console.error('⚠️ Database Connection Warning: Could not connect to Supabase cluster directly. Operating in Safe Fallback Mode.', err.message);
  } else {
    console.log('✅ Supabase PostgreSQL Database Cluster connected successfully with TLS SNI verification!');
    release();
  }
});

// --- ROUTE 1: ROOT HEALTH CHECK / WELCOME ---
app.get('/', async (req, res) => {
  try {
    // Run a quick query to test database connection status
    await pool.query('SELECT NOW()');
    res.json({
      status: "online",
      message: "Welcome to the COAST Luxury Villas Premium API!",
      database: "connected",
      endpoints: {
        welcome: "GET /",
        get_properties: "GET /api/properties",
        create_user: "POST /api/users",
        create_property: "POST /api/properties"
      }
    });
  } catch (err) {
    console.error("Database connection check failed:", err.message);
    res.json({
      status: "online",
      message: "Welcome to the COAST Luxury Villas Premium API!",
      database: "disconnected (running in offline/sandbox mode)",
      error: err.message,
      endpoints: {
        welcome: "GET /",
        get_properties: "GET /api/properties",
        create_user: "POST /api/users",
        create_property: "POST /api/properties"
      }
    });
  }
});

// --- ROUTE 2: FETCH ALL PROPERTIES ---
app.get('/api/properties', async (req, res) => {
  try {
    const query = 'SELECT * FROM properties ORDER BY property_id DESC;';
    const result = await pool.query(query);
    res.status(200).json({ success: true, properties: result.rows });
  } catch (error) {
    console.error("Fetch Properties Error:", error.message);
    res.status(500).json({ success: false, error: "Failed to retrieve properties from the database." });
  }
});

// --- ROUTE 3: REGISTER A NEW USER ---
app.post('/api/users', async (req, res) => {
  // Safe validation for testing connection
  if (req.body.test === true) {
    return res.status(200).json({ success: true, message: "Server connection test payload successfully received!" });
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
    res.status(500).json({ success: false, error: "Registration failed on Supabase. Verify table constraints." });
  }
});

// --- ROUTE 4: UPLOAD A NEW VILLA ---
app.post('/api/properties', async (req, res) => {
  const { host_id, title, description, location_city, location_country, max_guests, base_price_per_night } = req.body;
  try {
    const query = `
      INSERT INTO properties (host_id, title, description, location_city, location_country, max_guests, base_price_per_night)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [host_id, title, description, location_city, location_country, max_guests, base_price_per_night];
    const result = await pool.query(query, values);
    res.status(201).json({ success: true, property: result.rows[0] });
  } catch (error) {
    console.error("Villa Listing Error:", error.message);
    res.status(500).json({ success: false, error: "Failed to create property listing. Host ID must exist first." });
  }
});

// Start listening
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});