// Church booking table migration
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT, 10),
    ssl: { rejectUnauthorized: false }
});

async function addChurchBookingTable() {
    try {
        console.log('📋 Creating church_booking table...');
        
        const sql = `
            CREATE TABLE IF NOT EXISTS project.church_booking (
                booking_id SERIAL PRIMARY KEY,
                "date"     DATE        NOT NULL,
                start_time TIME        NOT NULL,
                end_time   TIME        NOT NULL,
                status     VARCHAR(30) NOT NULL,
                church_id  INTEGER     NOT NULL,
                wedding_id INTEGER     NOT NULL,
                CONSTRAINT fk_cb_church  FOREIGN KEY (church_id)  REFERENCES project.church(church_id)   ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_cb_wedding FOREIGN KEY (wedding_id) REFERENCES project.wedding(wedding_id) ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT chk_cb_time   CHECK (end_time > start_time)
            );
        `;
        
        await pool.query(sql);
        console.log('✅ church_booking table created successfully!');
        console.log('\n📌 Church booking endpoints are now available:');
        console.log('   GET  /api/weddings/:wid/church-bookings');
        console.log('   POST /api/weddings/:wid/church-bookings');
        console.log('   DELETE /api/church-bookings/:id\n');
        
        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error creating table:');
        console.error(err.message);
        console.error('\nNote: Table might already exist. Check with your database client.\n');
        await pool.end();
        process.exit(1);
    }
}

addChurchBookingTable();
