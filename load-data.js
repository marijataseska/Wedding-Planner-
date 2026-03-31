// Data loader script
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

async function loadData() {
    try {
        console.log('📂 Reading data file...');
        const dataFile = path.join(__dirname, 'data_load (1).sql');
        const dataSql = fs.readFileSync(dataFile, 'utf8');
        
        console.log('📥 Loading sample data...');
        await pool.query(dataSql);
        
        console.log('✅ Sample data loaded successfully!\n');
        console.log('🎊 Added:');
        console.log('  - 2 Users');
        console.log('  - 2 Weddings');
        console.log('  - 2 Venues');
        console.log('  - 2 Photographers');
        console.log('  - 2 Bands');
        console.log('  - 2 Registrars');
        console.log('  - 2 Events');
        console.log('  - 2 Guests');
        console.log('  - Sample bookings for all services\n');
        
        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Data loading error:');
        console.error(err.message);
        console.error('\nCheck:');
        console.error('  1. SSH tunnel is active (port 9999)');
        console.error('  2. Database credentials in .env');
        console.error('  3. Schema was created (run init-schema.js first)\n');
        await pool.end();
        process.exit(1);
    }
}

loadData();
