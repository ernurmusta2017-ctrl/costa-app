const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Configure Database with error handling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test DB connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('CRITICAL: Database connection failed:', err.message);
  } else {
    console.log('Database connected successfully');
  }
});

// Fetch all properties
app.get('/api/admin/properties', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM properties ORDER BY property_id DESC');
    res.json({ properties: result.rows });
  } catch (error) {
    console.error('GET properties error:', error);
    res.status(500).json({ error: "Failed to fetch properties." });
  }
});

// Update status
app.post('/api/admin/properties/:id/:action', async (req, res) => {
  const { id, action } = req.params;
  const status = action === 'approve' ? 'approved' : 'rejected';
  try {
    await pool.query("UPDATE properties SET status = $1 WHERE property_id = $2", [status, id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: "Action failed." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));