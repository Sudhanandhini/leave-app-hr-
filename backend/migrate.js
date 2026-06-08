require('dotenv').config();
const db = require('./src/config/db');

async function migrate() {
  try {
    await db.query(`
      ALTER TABLE attendance
      ADD COLUMN IF NOT EXISTS leave_source VARCHAR(30) DEFAULT NULL
    `);
    console.log('Migration done: leave_source column added to attendance table.');

    await db.query(`
      ALTER TABLE employees
      ADD COLUMN IF NOT EXISTS salary DECIMAL(12,2) DEFAULT 0
    `);
    console.log('Migration done: salary column added to employees table.');

    await db.query(`
      ALTER TABLE attendance
      ADD COLUMN IF NOT EXISTS login_time TIME DEFAULT NULL
    `);
    console.log('Migration done: login_time column added to attendance table.');

    await db.query(`
      ALTER TABLE attendance
      ADD COLUMN IF NOT EXISTS logout_time TIME DEFAULT NULL
    `);
    console.log('Migration done: logout_time column added to attendance table.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  }
  process.exit(0);
}

migrate();
