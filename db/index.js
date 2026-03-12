const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'chief.db');
const schemaPath = path.join(__dirname, 'schema.sql');

// Initialize DB
const db = new Database(dbPath, { verbose: console.log });

// Read and execute schema if the db was just created
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

module.exports = db;
