const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Serve static files from the root directory so admin.html and host.html load cleanly
app.use(express.static(__dirname));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- Page Routes ---

app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'admin.html'));
});

app.get('/host', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'host.html'));
});

// --- API Endpoints ---

// 1. Fetch all properties (returns direct array for frontend compatibility)
app.get('/api/admin/properties', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM properties ORDER BY property_id DESC');
        res.json(result.rows);
    } catch (error) {
        console.error("Fetch Properties Error:", error.message);
        res.status(500).json({ error: "Failed to fetch properties." });
    }
});

// 2. Fetch properties for a specific host/owner
app.get('/api/owner/properties', async (req, res) => {
    const ownerId = req.query.owner_id;
    try {
        const result = await pool.query('SELECT * FROM properties WHERE host_id = $1 ORDER BY property_id DESC', [ownerId]);
        res.json(result.rows);
    } catch (err) {
        console.error("Fetch Owner Properties Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 3. Add Property
app.post('/api/admin/properties/add', async (req, res) => {
    const { title, price, host_id, location_city, location_country, guests, image_url, description } = req.body;
    try {
        const query = `INSERT INTO properties (title, base_price_per_night, host_id, location_city, location_country, max_guests, image_url, description, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING *`;
        const result = await pool.query(query, [title, price, host_id, location_city, location_country, guests, image_url, description]);
        res.json({ success: true, property: result.rows[0] });
    } catch (error) {
        console.error("Property Insertion Error:", error.message);
        res.status(500).json({ error: "Database insertion failed." });
    }
});

// 4. Approve or Reject Property
app.post('/api/admin/properties/:id/:action', async (req, res) => {
    const { id, action } = req.params;
    const status = action === 'approve' ? 'active' : 'rejected';
    try {
        await pool.query("UPDATE properties SET status = $1 WHERE property_id = $2", [status, id]);
        res.json({ success: true });
    } catch (error) {
        console.error("Update Status Error:", error.message);
        res.status(500).json({ error: "Failed to update status." });
    }
});

// 5. Calendar Booking Endpoint
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

// 6. Auth Login (Updated to include is_admin)
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(
            "SELECT user_id, is_host, is_admin FROM users WHERE email = $1 AND password_hash = $2", 
            [email, password]
        );
        if (result.rows.length > 0) {
            res.json({ success: true, user: result.rows[0] });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials." });
        }
    } catch (error) {
        console.error("Login Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend running on port ${PORT}`));