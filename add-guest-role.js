// Add role column to guest table
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

async function addRoleColumn() {
    try {
        console.log('🔄 Adding role column to guest table...');
        
        await pool.query(`
            ALTER TABLE project.guest 
            ADD COLUMN IF NOT EXISTS role VARCHAR(100) DEFAULT 'Guest'
        `);
        
        console.log('✅ Role column added successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

addRoleColumn();
