// Schema initializer script
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT, 10),
    ssl: { rejectUnauthorized: false }
});

async function initializeSchema() {
    try {
        console.log('📂 Reading schema file...');
        const schemaFile = path.join(__dirname, 'schema_creation (1).sql');
        const schemaSql = fs.readFileSync(schemaFile, 'utf8');
        
        console.log('🗄️  Executing schema creation...');
        await pool.query(schemaSql);
        
        console.log('✅ Schema created successfully!');
        console.log('\nTables created:');
        console.log('  - project.user');
        console.log('  - project.wedding');
        console.log('  - project.event');
        console.log('  - project.guest');
        console.log('  - project.event_rsvp');
        console.log('  - project.attendance');
        console.log('  - project.venue');
        console.log('  - project.venue_booking');
        console.log('  - project.church');
        console.log('  - project.priest');
        console.log('  - project.photographer');
        console.log('  - project.vendor');
        console.log('  - project.budget_item');
        console.log('  - project.event_decoration');
        console.log('  - project.decoration');
        console.log('  - project.seating_chart');
        console.log('  - project.flower_decoration');
        console.log('  - And more...\n');
        
        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Schema creation error:');
        console.error(err.message);
        console.error('\nMake sure:');
        console.error('  1. SSH tunnel is active (port 9999)');
        console.error('  2. Database credentials in .env are correct');
        console.error('  3. You have permission to create schema');
        await pool.end();
        process.exit(1);
    }
}

initializeSchema();
