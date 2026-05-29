require('dotenv').config();
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

console.log('Running migration...');
console.log('DB Host:', process.env.DB_HOST);
console.log('DB User:', process.env.DB_USER);
console.log('DB Name:', process.env.DB_NAME);

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
    connectTimeout: 60000
});

const sql = fs.readFileSync(
    path.join(__dirname, 'migrations', '2026-05-27-over-collection-and-refunds.sql'),
    'utf8'
);

connection.connect((err) => {
    if (err) {
        console.error('Connection failed:', err.message);
        process.exit(1);
    }
    console.log('Connected to database');
    
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Migration failed:', err.message);
        } else {
            console.log('✅ Migration successful!');
            console.log('Tables created/updated successfully');
        }
        connection.end();
    });
});
