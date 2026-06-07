// =============================================================
//  Wedding Planner — Complete Backend (Node.js + Express)
//  Database: PostgreSQL via server
//  Auth: Session-based (login / register)
//  Email: Gmail via Nodemailer
// =============================================================

// Load environment variables
require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));

app.use(express.json());
const bcrypt = require('bcryptjs');
const session = require('express-session');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');
const PORT = process.env.PORT || 3000;

// =============================================================
//  MIDDLEWARE
// =============================================================
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve all HTML files from the same folder as this server.js
app.use(express.static(path.join(__dirname)));

// Session setup
app.use(session({
    secret: 'wedding_planner_secret_key_2025',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,       // set true only if using HTTPS
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 8  // 8 hours
    }
}));

// =============================================================
//  DATABASE CONNECTION
//
// =============================================================
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT, 10),
    ssl: { rejectUnauthorized: false }
});

// POST /api/weddings/:wid/guests/bulk — add multiple guests in a transaction
app.post('/api/weddings/:wid/guests/bulk', requireAuth, async (req, res) => {
    const { guests, sendEmails } = req.body;
    if (!Array.isArray(guests) || guests.length === 0) return res.status(400).json({ error: 'guests array is required.' });

    const wid = req.params.wid;
    const client = await pool.connect();
    try {
        // Ensure wedding exists
        const wRes = await client.query('SET search_path TO project; SELECT wedding_id, "date" FROM wedding WHERE wedding_id=$1', [wid]);
        if (wRes.rows.length === 0) {
            client.release();
            return res.status(404).json({ error: 'Wedding not found.' });
        }

        // Fetch events for this wedding
        const evRes = await client.query('SELECT event_id, event_type, "date", start_time, end_time FROM project.event WHERE wedding_id=$1 ORDER BY "date", start_time', [wid]);
        const events = evRes.rows;

        await client.query('BEGIN');
        const inserted = [];
        for (const g of guests) {
            const first_name = (g.first_name || '').trim();
            const last_name = (g.last_name || '').trim();
            const email = (g.email || null);
            const role = (g.role || null);
            if (!first_name || !last_name) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Each guest must have first_name and last_name.' });
            }
            const ins = await client.query('INSERT INTO project.guest(first_name,last_name,email,wedding_id,role) VALUES ($1,$2,$3,$4,$5) RETURNING *', [first_name, last_name, email, wid, role]);
            const guest = ins.rows[0];
            inserted.push(guest);

            // Create RSVP records for each event
            for (const ev of events) {
                try {
                    await client.query(
                        `INSERT INTO project.event_rsvp(status, response_date, guest_id, event_id)
                         VALUES ('invited', CURRENT_DATE, $1, $2)
                         ON CONFLICT (guest_id, event_id) DO NOTHING`,
                        [guest.guest_id, ev.event_id]
                    );
                } catch (e) {
                    // Log and continue
                    console.warn('Could not create RSVP for guest', guest.guest_id, 'event', ev.event_id, e.message);
                }
            }
        }

        await client.query('COMMIT');

        // Optionally send emails after commit
        if (sendEmails) {
            for (const guest of inserted) {
                if (!guest.email) continue;
                try {
                    // Build event links
                    const eventLinks = events.map(ev => {
                        const token = crypto.createHmac('sha256', 'wedding_rsvp_secret').update(`${guest.guest_id}-${ev.event_id}`).digest('hex');
                        const base = `http://localhost:${PORT}`;
                        return `
                            <tr>
                              <td style="padding:8px 0; font-size:15px; color:#2c1f1f;">
                                <strong>${ev.event_type}</strong> — ${ev.date} ${ev.start_time}–${ev.end_time}
                              </td>
                              <td style="padding:8px 0; text-align:right;">
                                <a href="${base}/rsvp.html?guest=${guest.guest_id}&event=${ev.event_id}&token=${token}&action=accepted" style="background:#3a9e6b;color:#fff;padding:6px 14px;border-radius:6px;text-decoration:none;margin-right:6px;font-size:13px;">✅ Accept</a>
                                <a href="${base}/rsvp.html?guest=${guest.guest_id}&event=${ev.event_id}&token=${token}&action=declined" style="background:#c94545;color:#fff;padding:6px 14px;border-radius:6px;text-decoration:none;font-size:13px;">❌ Decline</a>
                              </td>
                            </tr>`;
                    }).join('');

                    const mailOptions = {
                        from: `"Wedding Planner" <${process.env.EMAIL_USER}>`,
                        to: guest.email,
                        subject: `You're Invited! 💍 ${req.session.user.first_name} & ${req.session.user.last_name}'s Wedding`,
                        html: `
                            <div style="font-family:'DM Sans',Arial,sans-serif;max-width:600px;margin:auto;background:#fdf8f3;border-radius:12px;overflow:hidden;border:1px solid #ecddd0;">
                              <div style="background:linear-gradient(135deg,#d4606a,#e8949c);padding:32px;text-align:center;">
                                <div style="font-size:36px;margin-bottom:8px;">💍</div>
                                <h1 style="color:#fff;font-size:26px;margin:0;">You're Invited!</h1>
                                <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;">Wedding Invitation</p>
                              </div>
                              <div style="padding:32px;">
                                <p style="font-size:16px;color:#2c1f1f;">Dear <strong>${guest.first_name} ${guest.last_name}</strong>,</p>
                                <p style="font-size:15px;color:#6b4f4f;line-height:1.6;">Please RSVP for the events below:</p>
                                <table style="width:100%;border-collapse:collapse;">${eventLinks}</table>
                              </div>
                              <div style="background:#f2e8db;padding:16px;text-align:center;"></div>
                            </div>`
                    };
                    await transporter.sendMail(mailOptions);
                } catch (mailErr) {
                    console.warn('Failed to send invite to', guest.email, mailErr.message);
                }
            }
        }

        client.release();
        res.json({ inserted: inserted.length, guests: inserted });
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
        client.release();
        console.error('Bulk guest insert error:', err.message);
        if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
        res.status(500).json({ error: 'Server error during bulk guest insert.' });
    }
});

console.log('📡 Attempting to connect to PostgreSQL...');
console.log(`   Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
console.log(`   Database: ${process.env.DB_NAME}`);

pool.connect()
    .then(client => {
        console.log('✅  Connected to PostgreSQL database!');
        client.release();
    })
    .catch(err => {
        console.error('❌  DB connection error:', err.message);
        console.error('   Make sure SSH tunnel is running on port 9999');
        console.error('   SSH: ssh -L 9999:db_server:5432 t_wedding_planner2025@194.149.135.130');
        console.error('   Full error:', err.stack);
    });

// Helper: always use the project schema
const Q = (text, params) => pool.query(`SET search_path TO project; ${text}`, params);

// =============================================================
//  Service layer: Booking validation utilities
// =============================================================
class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const BookingService = {
    // Normalize date value (DATE from PG may be string or Date)
    _fmtDate(d) {
        if (!d) return null;
        if (d instanceof Date) return d.toISOString().slice(0,10);
        // assume string YYYY-MM-DD
        return String(d).slice(0,10);
    },

    // Check if two time intervals overlap: [s1,e1) and [s2,e2)
    isOverlapping(s1, e1, s2, e2) {
        if (!s1 || !e1 || !s2 || !e2) return false;
        // times are strings like HH:MM:SS or HH:MM
        const toSec = t => {
            const parts = String(t).split(':').map(Number);
            return (parts[0]||0)*3600 + (parts[1]||0)*60 + (parts[2]||0);
        };
        const a1 = toSec(s1), b1 = toSec(e1), a2 = toSec(s2), b2 = toSec(e2);
        return a1 < b2 && a2 < b1;
    },

    // Gather all bookings/events for a given wedding and date
    async getBookingsForWeddingDate(wedding_id, date) {
        const q = `
            SELECT 'venue' AS type, booking_id AS id, start_time, end_time
            FROM project.venue_booking WHERE wedding_id=$1 AND "date"=$2
            UNION ALL
            SELECT 'church' AS type, booking_id AS id, start_time, end_time
            FROM project.church_booking WHERE wedding_id=$1 AND "date"=$2
            UNION ALL
            SELECT 'registrar' AS type, booking_id AS id, start_time, end_time
            FROM project.registrar_booking WHERE wedding_id=$1 AND "date"=$2
            UNION ALL
            SELECT 'photographer' AS type, booking_id AS id, start_time, end_time
            FROM project.photographer_booking WHERE wedding_id=$1 AND "date"=$2
            UNION ALL
            SELECT 'band' AS type, booking_id AS id, start_time, end_time
            FROM project.band_booking WHERE wedding_id=$1 AND "date"=$2
            UNION ALL
            SELECT 'event' AS type, event_id AS id, start_time, end_time
            FROM project.event WHERE wedding_id=$1 AND "date"=$2
        `;
        const res = await pool.query(q, [wedding_id, date]);
        return res.rows;
    },

    // Validate booking date equals wedding date
    async validateDateMatchesWedding(wedding_id, date) {
        // Use SQL date cast/comparison to avoid client-side format issues
        const r = await pool.query('SELECT 1 FROM project.wedding WHERE wedding_id=$1 AND "date" = $2::date', [wedding_id, date]);
        if (r.rows.length === 0) {
            // Determine whether wedding not found or date mismatch
            const exists = await pool.query('SELECT 1 FROM project.wedding WHERE wedding_id=$1', [wedding_id]);
            if (exists.rows.length === 0) throw new ApiError(404, 'Wedding not found.');
            throw new ApiError(400, 'Booking is only allowed on the wedding date.');
        }
    },

    // Validate time slot overlap across all bookings for the wedding/date
    // exclude optional { type, id } to allow updating existing record
    async validateNoOverlap(wedding_id, date, start_time, end_time, exclude) {
        const bookings = await BookingService.getBookingsForWeddingDate(wedding_id, date);
        for (const b of bookings) {
            if (exclude && String(exclude.type) === String(b.type) && String(exclude.id) === String(b.id)) continue;
            if (BookingService.isOverlapping(start_time, end_time, b.start_time, b.end_time)) {
                throw new ApiError(409, 'Time slot conflict detected: this booking overlaps with another scheduled event.');
            }
        }
    },

    // Registrar location must match wedding venue location for that wedding date
    // We require an existing venue booking on the wedding date and compare locations
    async validateRegistrarLocation(wedding_id, date, registrar_id) {
        // find registrar
        const r = await pool.query('SELECT location FROM project.registrar WHERE registrar_id=$1', [registrar_id]);
        if (r.rows.length === 0) throw new ApiError(404, 'Registrar not found.');
        const regLoc = r.rows[0].location;

        // find venue booking(s) for the wedding on the date
        const vb = await pool.query('SELECT v.location FROM project.venue_booking vb JOIN project.venue v ON vb.venue_id=v.venue_id WHERE vb.wedding_id=$1 AND vb."date"=$2', [wedding_id, date]);
        if (vb.rows.length === 0) {
            // no venue booked on that date -> not allowed
            throw new ApiError(400, 'Registrar booking is only allowed at the wedding venue location.');
        }
        // require at least one matching venue location
        const match = vb.rows.some(x => String(x.location).trim().toLowerCase() === String(regLoc).trim().toLowerCase());
        if (!match) throw new ApiError(400, 'Registrar booking is only allowed at the wedding venue location.');
    }
};

// =============================================================
//  EMAIL TRANSPORTER
// =============================================================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// =============================================================
//  AUTH MIDDLEWARE — protect routes that require login
// =============================================================
function requireAuth(req, res, next) {
    if (req.session && req.session.user) return next();
    return res.status(401).json({ error: 'Not authenticated. Please log in.' });
}

// =============================================================
//  AUTH ROUTES
// =============================================================

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    const { first_name, last_name, email, password, phone_number, gender, birthday } = req.body;
    if (!first_name || !last_name || !email || !password)
        return res.status(400).json({ error: 'First name, last name, email and password are required.' });

    try {
        // Check email not already taken
        const exists = await pool.query(
            'SELECT user_id FROM project."user" WHERE email = $1', [email]
        );
        if (exists.rows.length > 0)
            return res.status(409).json({ error: 'Email already registered.' });

        const hash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO project."user"(first_name, last_name, email, password_hash, phone_number, gender, birthday)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING user_id, first_name, last_name, email, gender`,
            [first_name, last_name, email, hash, phone_number || null, gender || null, birthday || null]
        );

        const user = result.rows[0];
        req.session.user = user;
        res.status(201).json({ message: 'Registered successfully.', user });
    } catch (err) {
        console.error('Register error:', err.message);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: 'Email and password are required.' });

    try {
        const result = await pool.query(
            'SELECT * FROM project."user" WHERE email = $1', [email]
        );
        if (result.rows.length === 0)
            return res.status(401).json({ error: 'Invalid email or password.' });

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match)
            return res.status(401).json({ error: 'Invalid email or password.' });

        req.session.user = {
            user_id: user.user_id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            gender: user.gender
        };
        res.json({ message: 'Logged in.', user: req.session.user });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => res.json({ message: 'Logged out.' }));
});

// GET /api/auth/me — check current session
app.get('/api/auth/me', (req, res) => {
    if (req.session && req.session.user)
        return res.json({ user: req.session.user });
    res.status(401).json({ error: 'Not logged in.' });
});

// =============================================================
//  USER / PROFILE
// =============================================================

// GET /api/users/:id
app.get('/api/users/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT user_id, first_name, last_name, email, phone_number, gender, birthday FROM project."user" WHERE user_id = $1',
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/users/:id — update profile
app.put('/api/users/:id', requireAuth, async (req, res) => {
    const { first_name, last_name, email, phone_number, gender, birthday } = req.body;
    try {
        const result = await pool.query(
            `UPDATE project."user"
             SET first_name=$1, last_name=$2, email=$3, phone_number=$4, gender=$5, birthday=$6
             WHERE user_id=$7 RETURNING user_id, first_name, last_name, email, phone_number, gender, birthday`,
            [first_name, last_name, email, phone_number, gender, birthday || null, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
        // Update session too
        req.session.user = { ...req.session.user, ...result.rows[0] };
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// =============================================================
//  WEDDINGS  (UC0003)
// =============================================================

// GET /api/weddings — get wedding(s) for logged-in user
app.get('/api/weddings', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM project.wedding WHERE user_id = $1 ORDER BY date',
            [req.session.user.user_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/weddings/:id
app.get('/api/weddings/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM project.wedding WHERE wedding_id = $1 AND user_id = $2',
            [req.params.id, req.session.user.user_id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Wedding not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/weddings — create wedding
app.post('/api/weddings', requireAuth, async (req, res) => {
    const { date, budget, notes } = req.body;
    if (!date) return res.status(400).json({ error: 'Wedding date is required.' });
    try {
        const result = await pool.query(
            'INSERT INTO project.wedding("date", budget, notes, user_id) VALUES ($1,$2,$3,$4) RETURNING *',
            [date, budget || null, notes || null, req.session.user.user_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/weddings/:id
app.put('/api/weddings/:id', requireAuth, async (req, res) => {
    const { date, budget, notes } = req.body;
    try {
        const result = await pool.query(
            `UPDATE project.wedding SET "date"=$1, budget=$2, notes=$3
             WHERE wedding_id=$4 AND user_id=$5 RETURNING *`,
            [date, budget || null, notes || null, req.params.id, req.session.user.user_id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Wedding not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/weddings/:id
app.delete('/api/weddings/:id', requireAuth, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM project.wedding WHERE wedding_id=$1 AND user_id=$2',
            [req.params.id, req.session.user.user_id]
        );
        res.json({ message: 'Wedding deleted.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// =============================================================
//  EVENTS  (UC0005)
// =============================================================

// GET /api/weddings/:wid/events
app.get('/api/weddings/:wid/events', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM project.event WHERE wedding_id=$1 ORDER BY "date", start_time',
            [req.params.wid]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/weddings/:wid/events
app.post('/api/weddings/:wid/events', requireAuth, async (req, res) => {
    const { event_type, date, start_time, end_time, status } = req.body;
    if (!event_type || !date || !start_time || !end_time)
        return res.status(400).json({ error: 'event_type, date, start_time, end_time are required.' });
    try {
        // Business validations
        await BookingService.validateDateMatchesWedding(req.params.wid, date);
        await BookingService.validateNoOverlap(req.params.wid, date, start_time, end_time, null);

        const result = await pool.query(
            `INSERT INTO project.event(event_type,"date",start_time,end_time,status,wedding_id)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [event_type, date, start_time, end_time, status || 'scheduled', req.params.wid]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/events/:id
app.put('/api/events/:id', requireAuth, async (req, res) => {
    const { event_type, date, start_time, end_time, status } = req.body;
    try {
        // fetch existing event to know wedding_id and current values
        const evRes = await pool.query('SELECT * FROM project.event WHERE event_id=$1', [req.params.id]);
        if (evRes.rows.length === 0) return res.status(404).json({ error: 'Event not found.' });
        const ev = evRes.rows[0];
        const weddingId = ev.wedding_id;
        // Validate date matches wedding and no overlap (exclude this event)
        await BookingService.validateDateMatchesWedding(weddingId, date);
        await BookingService.validateNoOverlap(weddingId, date, start_time, end_time, { type: 'event', id: req.params.id });

        const result = await pool.query(
            `UPDATE project.event SET event_type=$1,"date"=$2,start_time=$3,end_time=$4,status=$5
             WHERE event_id=$6 RETURNING *`,
            [event_type, date, start_time, end_time, status, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/events/:id
app.delete('/api/events/:id', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM project.event WHERE event_id=$1', [req.params.id]);
        res.json({ message: 'Event deleted.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// =============================================================
//  GUESTS  (UC0004)
// =============================================================

// GET /api/weddings/:wid/guests
app.get('/api/weddings/:wid/guests', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT guest_id, first_name, last_name, email, role, wedding_id FROM project.guest WHERE wedding_id=$1 ORDER BY last_name, first_name',
            [req.params.wid]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/weddings/:wid/guests — add guest + send email invite
app.post('/api/weddings/:wid/guests', requireAuth, async (req, res) => {
    const { first_name, last_name, email, role } = req.body;
    if (!first_name || !last_name)
        return res.status(400).json({ error: 'First name and last name are required.' });

    try {
        // Insert guest
        const result = await pool.query(
            'INSERT INTO project.guest(first_name,last_name,email,wedding_id) VALUES ($1,$2,$3,$4) RETURNING *',
            [first_name, last_name, email || null, req.params.wid]
        );
        const guest = result.rows[0];

        // Fetch wedding info for the email
        const weddingResult = await pool.query(
            `SELECT w."date", u.first_name AS owner_first, u.last_name AS owner_last
             FROM project.wedding w
             JOIN project."user" u ON w.user_id = u.user_id
             WHERE w.wedding_id = $1`,
            [req.params.wid]
        );
        const wedding = weddingResult.rows[0];

        // Fetch all events for this wedding so guest can RSVP
        const eventsResult = await pool.query(
            'SELECT * FROM project.event WHERE wedding_id=$1 ORDER BY "date", start_time',
            [req.params.wid]
        );
        const events = eventsResult.rows;

        // Create initial RSVP records with status "invited" for each event
        for (const event of events) {
            try {
                await pool.query(
                    `INSERT INTO project.event_rsvp(status, response_date, guest_id, event_id)
                     VALUES ('invited', CURRENT_DATE, $1, $2)
                     ON CONFLICT (guest_id, event_id) DO NOTHING`,
                    [guest.guest_id, event.event_id]
                );
            } catch (rsvpErr) {
                console.warn(`⚠️  Could not create RSVP record for guest ${guest.guest_id}, event ${event.event_id}:`, rsvpErr.message);
            }
        }

        // Send email invitation if email provided
        if (email && events.length > 0) {
            // Generate a secure token per event for the RSVP links
            const eventLinks = events.map(ev => {
                const token = crypto
                    .createHmac('sha256', 'wedding_rsvp_secret')
                    .update(`${guest.guest_id}-${ev.event_id}`)
                    .digest('hex');
                const base = `http://localhost:${PORT}`;
                return `
                    <tr>
                      <td style="padding:8px 0; font-size:15px; color:#2c1f1f;">
                        <strong>${ev.event_type}</strong> — ${ev.date} ${ev.start_time}–${ev.end_time}
                      </td>
                      <td style="padding:8px 0; text-align:right;">
                        <a href="${base}/rsvp.html?guest=${guest.guest_id}&event=${ev.event_id}&token=${token}&action=accepted"
                           style="background:#3a9e6b;color:#fff;padding:6px 14px;border-radius:6px;text-decoration:none;margin-right:6px;font-size:13px;">
                          ✅ Accept
                        </a>
                        <a href="${base}/rsvp.html?guest=${guest.guest_id}&event=${ev.event_id}&token=${token}&action=declined"
                           style="background:#c94545;color:#fff;padding:6px 14px;border-radius:6px;text-decoration:none;font-size:13px;">
                          ❌ Decline
                        </a>
                      </td>
                    </tr>`;
            }).join('');

            const mailOptions = {
                from: `"Wedding Planner" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: `You're Invited! 💍 ${wedding.owner_first} & ${wedding.owner_last}'s Wedding`,
                html: `
                    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:600px;margin:auto;background:#fdf8f3;border-radius:12px;overflow:hidden;border:1px solid #ecddd0;">
                      <div style="background:linear-gradient(135deg,#d4606a,#e8949c);padding:32px;text-align:center;">
                        <div style="font-size:36px;margin-bottom:8px;">💍</div>
                        <h1 style="color:#fff;font-size:26px;margin:0;">You're Invited!</h1>
                        <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;">Wedding of ${wedding.owner_first} &amp; ${wedding.owner_last}</p>
                      </div>
                      <div style="padding:32px;">
                        <p style="font-size:16px;color:#2c1f1f;">Dear <strong>${first_name} ${last_name}</strong>,</p>
                        <p style="font-size:15px;color:#6b4f4f;line-height:1.6;">
                          We are delighted to invite you to celebrate the wedding of
                          <strong>${wedding.owner_first} &amp; ${wedding.owner_last}</strong>
                          on <strong>${wedding.date}</strong>.
                        </p>
                        <p style="font-size:15px;color:#2c1f1f;font-weight:600;margin-top:24px;">Please RSVP for each event:</p>
                        <table style="width:100%;border-collapse:collapse;">
                          ${eventLinks}
                        </table>
                        <p style="font-size:13px;color:#a08080;margin-top:24px;">
                          We look forward to celebrating with you. If you have any questions, please contact us directly.
                        </p>
                      </div>
                      <div style="background:#f2e8db;padding:16px;text-align:center;">
                        <p style="font-size:12px;color:#a08080;margin:0;">Wedding Planner App · Sent with love 💌</p>
                      </div>
                    </div>`
            };

            try {
                await transporter.sendMail(mailOptions);
                console.log(`📧  Invite sent to ${email}`);
            } catch (mailErr) {
                // Don't fail the guest insert if email fails — just log it
                console.warn('⚠️  Email send failed (guest still added):', mailErr.message);
            }
        }

        res.status(201).json({ guest, emailSent: !!(email && events.length > 0) });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/guests/:id
app.put('/api/guests/:id', requireAuth, async (req, res) => {
    const { first_name, last_name, email, role } = req.body;
    try {
        const result = await pool.query(
            'UPDATE project.guest SET first_name=$1,last_name=$2,email=$3,role=$4 WHERE guest_id=$5 RETURNING *',
            [first_name, last_name, email || null, role || 'Guest', req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Guest not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/guests/:id
app.delete('/api/guests/:id', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM project.guest WHERE guest_id=$1', [req.params.id]);
        res.json({ message: 'Guest deleted.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// =============================================================
//  RSVP  (UC0009)
// =============================================================

// GET /api/rsvp?guest_id=&event_id= — check existing RSVP
app.get('/api/rsvp', async (req, res) => {
    const { guest_id, event_id } = req.query;
    try {
        const result = await pool.query(
            'SELECT * FROM project.event_rsvp WHERE guest_id=$1 AND event_id=$2',
            [guest_id, event_id]
        );
        res.json(result.rows[0] || null);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/rsvp — guest submits RSVP (called from rsvp.html, no auth needed)
app.post('/api/rsvp', async (req, res) => {
    const { guest_id, event_id, status, token } = req.body;
    if (!guest_id || !event_id || !status)
        return res.status(400).json({ error: 'guest_id, event_id and status are required.' });

    // Verify token (protects against random submissions)
    const expected = crypto
        .createHmac('sha256', 'wedding_rsvp_secret')
        .update(`${guest_id}-${event_id}`)
        .digest('hex');
    if (token !== expected)
        return res.status(403).json({ error: 'Invalid or expired RSVP link.' });

    const validStatuses = ['accepted', 'declined', 'pending', 'invited'];
    if (!validStatuses.includes(status))
        return res.status(400).json({ error: 'Status must be accepted, declined, pending, or invited.' });

    try {
        // Upsert: update if exists, insert if not
        const result = await pool.query(
            `INSERT INTO project.event_rsvp(status, response_date, guest_id, event_id)
             VALUES ($1, CURRENT_DATE, $2, $3)
             ON CONFLICT (guest_id, event_id)
             DO UPDATE SET status=$1, response_date=CURRENT_DATE
             RETURNING *`,
            [status, guest_id, event_id]
        );

        // Fetch guest + event info for the confirmation response
        const guestInfo = await pool.query(
            `SELECT g.first_name, g.last_name, e.event_type, e.date, e.start_time, e.end_time
             FROM project.guest g, project.event e
             WHERE g.guest_id=$1 AND e.event_id=$2`,
            [guest_id, event_id]
        );

        res.json({
            rsvp: result.rows[0],
            guest: guestInfo.rows[0] || null
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/weddings/:wid/rsvp — all RSVPs for a wedding (for admin view)
app.get('/api/weddings/:wid/rsvp', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT er.response_id, er.status, er.response_date,
                    g.guest_id, g.first_name, g.last_name, g.email,
                    e.event_id, e.event_type, e.date AS event_date
             FROM project.event_rsvp er
             JOIN project.guest g ON er.guest_id = g.guest_id
             JOIN project.event e ON er.event_id = e.event_id
             WHERE e.wedding_id = $1
             ORDER BY e.date, g.last_name`,
            [req.params.wid]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// =============================================================
//  ATTENDANCE / SEATING  (UC0011)
// =============================================================

// GET /api/weddings/:wid/attendance — full seating list for a wedding
app.get('/api/weddings/:wid/attendance', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT a.attendance_id, a.status, a.table_number, a.role,
                    g.guest_id, g.first_name, g.last_name,
                    e.event_id, e.event_type
             FROM project.attendance a
             JOIN project.guest g ON a.guest_id = g.guest_id
             JOIN project.event e ON a.event_id = e.event_id
             WHERE e.wedding_id = $1
             ORDER BY a.table_number NULLS LAST, g.last_name`,
            [req.params.wid]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/events/:eid/attendance — seating for a specific event
app.get('/api/events/:eid/attendance', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT a.attendance_id, a.status, a.table_number, a.role,
                    g.guest_id, g.first_name, g.last_name
             FROM project.attendance a
             JOIN project.guest g ON a.guest_id = g.guest_id
             WHERE a.event_id = $1
             ORDER BY a.table_number NULLS LAST, g.last_name`,
            [req.params.eid]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/attendance — assign guest to event with table + role
app.post('/api/attendance', requireAuth, async (req, res) => {
    const { table_number, role, guest_id, event_id } = req.body;
    if (!guest_id || !event_id || !role)
        return res.status(400).json({ error: 'guest_id, event_id and role are required.' });
    try {
        // Fetch the guest's RSVP status for this event
        const rsvpResult = await pool.query(
            'SELECT status FROM project.event_rsvp WHERE guest_id=$1 AND event_id=$2',
            [guest_id, event_id]
        );
        const rsvpStatus = rsvpResult.rows[0]?.status || 'pending';

        const result = await pool.query(
            `INSERT INTO project.attendance(status, table_number, role, guest_id, event_id)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (guest_id, event_id)
             DO UPDATE SET status=$1, table_number=$2, role=$3
             RETURNING *`,
            [rsvpStatus, table_number || null, role, guest_id, event_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/attendance/:id — update seating assignment
app.put('/api/attendance/:id', requireAuth, async (req, res) => {
    const { table_number, role } = req.body;
    try {
        // Fetch the attendance record to get guest_id and event_id
        const attendanceRecord = await pool.query(
            'SELECT guest_id, event_id FROM project.attendance WHERE attendance_id=$1',
            [req.params.id]
        );
        if (attendanceRecord.rows.length === 0) 
            return res.status(404).json({ error: 'Record not found.' });
        
        const { guest_id, event_id } = attendanceRecord.rows[0];

        // Fetch the guest's RSVP status for this event
        const rsvpResult = await pool.query(
            'SELECT status FROM project.event_rsvp WHERE guest_id=$1 AND event_id=$2',
            [guest_id, event_id]
        );
        const rsvpStatus = rsvpResult.rows[0]?.status || 'pending';

        const result = await pool.query(
            `UPDATE project.attendance SET status=$1, table_number=$2, role=$3
             WHERE attendance_id=$4 RETURNING *`,
            [rsvpStatus, table_number || null, role, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/attendance/:id
app.delete('/api/attendance/:id', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM project.attendance WHERE attendance_id=$1', [req.params.id]);
        res.json({ message: 'Attendance record deleted.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// =============================================================
//  VENUES  (UC0006)
// =============================================================

// GET /api/venues — all venues with type name
app.get('/api/venues', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT v.*, vt.type_name
             FROM project.venue v
             JOIN project.venue_type vt ON v.type_id = vt.type_id
             ORDER BY v.city, v.name`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/weddings/:wid/venue-bookings
app.get('/api/weddings/:wid/venue-bookings', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT vb.*, v.name AS venue_name, v.location, v.city
             FROM project.venue_booking vb
             JOIN project.venue v ON vb.venue_id = v.venue_id
             WHERE vb.wedding_id = $1
             ORDER BY vb.date`,
            [req.params.wid]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/weddings/:wid/venue-bookings
app.post('/api/weddings/:wid/venue-bookings', requireAuth, async (req, res) => {
    const { date, start_time, end_time, status, price, venue_id } = req.body;
    if (!date || !start_time || !end_time || !venue_id)
        return res.status(400).json({ error: 'date, start_time, end_time and venue_id are required.' });

    // Check availability: no overlapping booking for same venue on same date
    try {
        // Business validations
        await BookingService.validateDateMatchesWedding(req.params.wid, date);
        await BookingService.validateNoOverlap(req.params.wid, date, start_time, end_time, null);

        const conflict = await pool.query(
            `SELECT booking_id FROM project.venue_booking
             WHERE venue_id=$1 AND "date"=$2
               AND NOT (end_time <= $3 OR start_time >= $4)`,
            [venue_id, date, start_time, end_time]
        );
        if (conflict.rows.length > 0)
            return res.status(409).json({ error: 'Venue is already booked during this time slot.' });

        const result = await pool.query(
            `INSERT INTO project.venue_booking("date",start_time,end_time,status,price,venue_id,wedding_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [date, start_time, end_time, status || 'confirmed', price || 0, venue_id, req.params.wid]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/venue-bookings/:id
app.delete('/api/venue-bookings/:id', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM project.venue_booking WHERE booking_id=$1', [req.params.id]);
        res.json({ message: 'Venue booking cancelled.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// =============================================================
//  BANDS  (UC0007)
// =============================================================

// GET /api/bands
app.get('/api/bands', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM project.band ORDER BY band_name');
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/weddings/:wid/band-bookings
app.get('/api/weddings/:wid/band-bookings', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT bb.*, b.band_name, b.genre
             FROM project.band_booking bb
             JOIN project.band b ON bb.band_id = b.band_id
             WHERE bb.wedding_id=$1 ORDER BY bb.date`,
            [req.params.wid]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/weddings/:wid/band-bookings
app.post('/api/weddings/:wid/band-bookings', requireAuth, async (req, res) => {
    const { date, start_time, end_time, status, band_id } = req.body;
    if (!date || !start_time || !end_time || !band_id)
        return res.status(400).json({ error: 'date, start_time, end_time and band_id are required.' });
    try {
        // Business validations
        await BookingService.validateDateMatchesWedding(req.params.wid, date);
        await BookingService.validateNoOverlap(req.params.wid, date, start_time, end_time, null);
        const result = await pool.query(
            `INSERT INTO project.band_booking("date",start_time,end_time,status,band_id,wedding_id)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [date, start_time, end_time, status || 'confirmed', band_id, req.params.wid]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/band-bookings/:id
app.delete('/api/band-bookings/:id', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM project.band_booking WHERE booking_id=$1', [req.params.id]);
        res.json({ message: 'Band booking removed.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// =============================================================
//  PHOTOGRAPHERS  (UC0008)
// =============================================================

// GET /api/photographers
app.get('/api/photographers', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM project.photographer ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/weddings/:wid/photographer-bookings
app.get('/api/weddings/:wid/photographer-bookings', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT pb.*, p.name AS photographer_name, p.email AS photographer_email
             FROM project.photographer_booking pb
             JOIN project.photographer p ON pb.photographer_id = p.photographer_id
             WHERE pb.wedding_id=$1 ORDER BY pb.date`,
            [req.params.wid]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/weddings/:wid/photographer-bookings
app.post('/api/weddings/:wid/photographer-bookings', requireAuth, async (req, res) => {
    const { date, start_time, end_time, status, photographer_id } = req.body;
    if (!date || !start_time || !end_time || !photographer_id)
        return res.status(400).json({ error: 'date, start_time, end_time and photographer_id are required.' });
    try {
        // Business validations
        await BookingService.validateDateMatchesWedding(req.params.wid, date);
        await BookingService.validateNoOverlap(req.params.wid, date, start_time, end_time, null);
        const result = await pool.query(
            `INSERT INTO project.photographer_booking("date",start_time,end_time,status,photographer_id,wedding_id)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [date, start_time, end_time, status || 'confirmed', photographer_id, req.params.wid]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/photographer-bookings/:id
app.delete('/api/photographer-bookings/:id', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM project.photographer_booking WHERE booking_id=$1', [req.params.id]);
        res.json({ message: 'Photographer booking removed.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// =============================================================
//  CHURCHES + PRIESTS
// =============================================================

// GET /api/churches — all churches with their linked priest
app.get('/api/churches', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.*, p.name AS priest_name, p.contact AS priest_contact
             FROM project.church c
             LEFT JOIN project.priest p ON p.church_id = c.church_id
             ORDER BY c.name`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/weddings/:wid/church-bookings
app.get('/api/weddings/:wid/church-bookings', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT cb.*, c.name AS church_name, c.location, c.contact,
                    p.name AS priest_name, p.contact AS priest_contact
             FROM project.church_booking cb
             JOIN project.church c ON cb.church_id = c.church_id
             LEFT JOIN project.priest p ON p.church_id = c.church_id
             WHERE cb.wedding_id=$1 ORDER BY cb.date`,
            [req.params.wid]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/weddings/:wid/church-bookings
app.post('/api/weddings/:wid/church-bookings', requireAuth, async (req, res) => {
    const { date, start_time, end_time, status, church_id } = req.body;
    if (!date || !start_time || !end_time || !church_id)
        return res.status(400).json({ error: 'date, start_time, end_time and church_id are required.' });
    try {
        // Business validations
        await BookingService.validateDateMatchesWedding(req.params.wid, date);
        await BookingService.validateNoOverlap(req.params.wid, date, start_time, end_time, null);
        const result = await pool.query(
            `INSERT INTO project.church_booking("date",start_time,end_time,status,church_id,wedding_id)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [date, start_time, end_time, status || 'confirmed', church_id, req.params.wid]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/church-bookings/:id
app.delete('/api/church-bookings/:id', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM project.church_booking WHERE booking_id=$1', [req.params.id]);
        res.json({ message: 'Church booking removed.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// =============================================================
//  REGISTRARS
// =============================================================

// GET /api/registrars
app.get('/api/registrars', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM project.registrar ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/weddings/:wid/registrar-bookings
app.get('/api/weddings/:wid/registrar-bookings', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT rb.*, r.name AS registrar_name, r.location
             FROM project.registrar_booking rb
             JOIN project.registrar r ON rb.registrar_id = r.registrar_id
             WHERE rb.wedding_id=$1 ORDER BY rb.date`,
            [req.params.wid]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/weddings/:wid/registrar-bookings
app.post('/api/weddings/:wid/registrar-bookings', requireAuth, async (req, res) => {
    const { date, start_time, end_time, status, registrar_id } = req.body;
    if (!date || !start_time || !end_time || !registrar_id)
        return res.status(400).json({ error: 'date, start_time, end_time and registrar_id are required.' });
    try {
        // Business validations
        await BookingService.validateDateMatchesWedding(req.params.wid, date);
        await BookingService.validateNoOverlap(req.params.wid, date, start_time, end_time, null);
        await BookingService.validateRegistrarLocation(req.params.wid, date, registrar_id);

        const result = await pool.query(
            `INSERT INTO project.registrar_booking("date",start_time,end_time,status,registrar_id,wedding_id)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [date, start_time, end_time, status || 'confirmed', registrar_id, req.params.wid]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/registrar-bookings/:id
app.delete('/api/registrar-bookings/:id', requireAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM project.registrar_booking WHERE booking_id=$1', [req.params.id]);
        res.json({ message: 'Registrar booking removed.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error.' });
    }
});

// =============================================================
//  START SERVER
// =============================================================
app.listen(PORT, () => {
    console.log(`\n🌸  Wedding Planner server running at http://localhost:${PORT}`);
    console.log(`   Dashboard  → http://localhost:${PORT}/Wedding_Planner.html`);
    console.log(`   Login      → http://localhost:${PORT}/login.html`);
    console.log(`   RSVP page  → http://localhost:${PORT}/rsvp.html\n`);
});