const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
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

// --- Root Health Check (Required for frontend DB Control Center handshake) ---
app.get('/', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: "online", database: "connected" });
    } catch (error) {
        res.json({ status: "online", database: "disconnected" });
    }
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

// 6. Auth Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(
            "SELECT user_id, email, password_hash, is_host, is_admin FROM users WHERE email = $1", 
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: "Invalid credentials." });
        }

        const user = result.rows[0];
        
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid credentials." });
        }

        res.json({ 
            success: true, 
            user: { 
                user_id: user.user_id, 
                email: user.email, 
                is_host: user.is_host, 
                is_admin: user.is_admin 
            } 
        });
    } catch (error) {
        console.error("Login Error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 7. Auth Register (Host Signup)
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const existing = await pool.query("SELECT user_id FROM users WHERE email = $1", [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Email is already registered." });
        }

        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        const query = `
            INSERT INTO users (email, password_hash, is_host, is_admin) 
            VALUES ($1, $2, true, false) 
            RETURNING user_id, email, is_host, is_admin
        `;
        const result = await pool.query(query, [email, password_hash]);

        res.status(201).json({ 
            success: true, 
            message: "Account created successfully", 
            user: result.rows[0] 
        });
    } catch (error) {
        console.error("Registration Error:", error.message);
        res.status(500).json({ success: false, error: "Database insertion failed during registration." });
    }
});

// 8. General User Registration Endpoint
app.post('/api/admin/users', async (req, res) => {
    const { firstName, lastName, email, phone, isHost, password } = req.body;

    try {
        const existing = await pool.query("SELECT user_id FROM users WHERE email = $1", [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Email is already registered." });
        }

        const rawPassword = password || Math.random().toString(36).slice(-8);
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(rawPassword, saltRounds);

        const query = `
            INSERT INTO users (first_name, last_name, email, phone, password_hash, is_host, is_admin) 
            VALUES ($1, $2, $3, $4, $5, $6, false) 
            RETURNING user_id, first_name, last_name, email, phone, is_host
        `;
        
        const result = await pool.query(query, [
            firstName || '', 
            lastName || '', 
            email, 
            phone || '', 
            password_hash, 
            Boolean(isHost)
        ]);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: result.rows[0]
        });
    } catch (error) {
        console.error("Database User Registration Error:", error.message);
        res.status(500).json({ success: false, message: 'Database error during registration.' });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend running on port ${PORT}`));
