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

// Fetch all properties
app.get('/api/admin/properties', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM properties ORDER BY property_id DESC');
    res.json({ properties: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch properties." });
  }
});

// Approve Property
app.post('/api/admin/properties/:id/approve', async (req, res) => {
  try {
    await pool.query("UPDATE properties SET status = 'approved' WHERE property_id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Approval failed." });
  }
});

// Reject Property
app.post('/api/admin/properties/:id/reject', async (req, res) => {
  try {
    await pool.query("UPDATE properties SET status = 'rejected' WHERE property_id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Rejection failed." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));