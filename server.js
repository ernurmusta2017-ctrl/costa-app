const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Configure connection to Supabase database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
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
        users: "/api/users [POST]",
        properties: "/api/properties [POST]"
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
        users: "/api/users [POST]",
        properties: "/api/properties [POST]"
      }
    });
  }
});

// --- ROUTE 2: REGISTER A NEW USER ---
app.post('/api/users', async (req, res) => {
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
    console.error("User registration error:", error.message);
    res.status(500).json({ success: false, error: "Registration failed." });
  }
});

// --- ROUTE 3: UPLOAD A NEW VILLA ---
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
    console.error("Property upload error:", error.message);
    res.status(500).json({ success: false, error: "Failed to create property listing." });
  }
});

// Start listening
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});