// Fix sample user passwords
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT, 10),
    ssl: { rejectUnauthorized: false }
});

async function fixPasswords() {
    try {
        console.log('🔐 Fixing sample user passwords...\n');
        
        // Sample users: password = "password123"
        const testPassword = 'password123';
        const hash = await bcrypt.hash(testPassword, 10);
        
        const result = await pool.query(
            `UPDATE project."user" 
             SET password_hash = $1 
             WHERE email IN ('ana.trajkovska@gmail.com', 'stefan.petrovski@gmail.com')
             RETURNING user_id, email, password_hash`
        , [hash]);
        
        console.log('✅ Updated users:');
        result.rows.forEach(row => {
            console.log(`   📧 ${row.email}`);
        });
        
        console.log('\n🔑 Test credentials:');
        console.log('   Email:    ana.trajkovska@gmail.com');
        console.log('   Password: password123');
        console.log('   —— OR ——');
        console.log('   Email:    stefan.petrovski@gmail.com');
        console.log('   Password: password123\n');
        
        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        await pool.end();
        process.exit(1);
    }
}

fixPasswords();
