import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';

console.log('\n=============================================');
console.log('       GODADDY MYSQL CONNECTION TEST         ');
console.log('=============================================\n');

const host = process.env.DB_HOST || 'localhost';
const port = Number(process.env.DB_PORT || 3306);
const user = process.env.DB_USER || '';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_NAME || '';
const databaseUrl = process.env.DATABASE_URL || '';

console.log('Detected Configuration:');
console.log(`- DB_HOST:      ${host}`);
console.log(`- DB_PORT:      ${port}`);
console.log(`- DB_USER:      ${user ? user : '(not set in DB_USER)'}`);
console.log(`- DB_PASSWORD:  ${password ? '********' : '(not set in DB_PASSWORD)'}`);
console.log(`- DB_NAME:      ${database ? database : '(not set in DB_NAME)'}`);
console.log(`- DATABASE_URL: ${databaseUrl ? databaseUrl.replace(/:([^:@]+)@/, ':****@') : '(not set)'}\n`);

async function testConnection() {
  let connection;
  try {
    console.log('Attempting direct MySQL connection via mysql2...');
    if (databaseUrl) {
      connection = await mysql.createConnection(databaseUrl);
    } else {
      connection = await mysql.createConnection({
        host,
        port,
        user,
        password,
        database,
      });
    }

    console.log('✅ SUCCESS: Connected to MySQL server successfully!');

    const [tables] = await connection.query('SHOW TABLES;');
    console.log(`✅ SUCCESS: Found ${tables.length} table(s) in database "${database || 'default'}".`);

    if (tables.length === 0) {
      console.log('\n⚠️ WARNING: Database has 0 tables! Please import "godaddy_erp_mysql.sql" in phpMyAdmin.');
    } else {
      try {
        const [users] = await connection.query('SELECT COUNT(*) as count FROM `User`;');
        console.log(`✅ SUCCESS: "User" table verified with ${users[0].count} user record(s).`);
      } catch (e) {
        console.log('⚠️ Could not query "User" table:', e.message);
      }
    }
  } catch (err) {
    console.error('\n❌ CONNECTION FAILED:');
    console.error(`- Error Code:    ${err.code || 'UNKNOWN'}`);
    console.error(`- Error Message: ${err.message}`);
    console.error('\nTroubleshooting Checklist:');
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('1. In GoDaddy cPanel -> MySQL Databases, ensure the user has been added to the database with ALL PRIVILEGES.');
      console.log('2. Check DB_USER and DB_PASSWORD in .env.');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.log('1. The database name is incorrect. In GoDaddy, check the exact name in cPanel (e.g., cpuser_dbname).');
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      console.log('1. Check DB_HOST. On GoDaddy cPanel, try "localhost" or "127.0.0.1".');
      console.log('2. Ensure MySQL service is running.');
    }
  } finally {
    if (connection) await connection.end();
  }
}

testConnection();
