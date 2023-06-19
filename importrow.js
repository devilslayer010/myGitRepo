const express = require('express');
const multer = require('multer');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'demo', // Specify a default database
});

// Create an Express application
const app = express();

// Set up Multer for file upload
const upload = multer({ dest: 'uploads/' });

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Define a route for retrieving the database names
app.get('/databases', async (req, res) => {
  try {
    const databaseNames = await getDatabaseNames();
    res.json(databaseNames);
  } catch (error) {
    console.error('Error retrieving database names:', error);
    res.status(500).json({ error: 'Error retrieving database names' });
  }
});

app.get('/tables', async (req, res) => {
  try {
    const databaseName = req.query.database;
    const tableNames = await getTableNames(databaseName);
    res.json(tableNames);
  } catch (error) {
    console.error('Error retrieving table names:', error);
    res.status(500).json({ error: 'Error retrieving table names' });
  }
});
// Define a route for the file upload form
// Update the root route handler to fetch table names based on the selected database
// Update the root route handler to fetch table names based on the selected database
app.get('/', async (req, res) => {
  try {
    const databaseNames = await getDatabaseNames();
    const selectedDatabase = req.query.database || '';
    const tableNames = await getTableNames(selectedDatabase);
    res.render('importrow', { message: null, databaseNames, tableNames, selectedDatabase }); // Include selectedDatabase in the data object passed to the template
  } catch (error) {
    console.error('Error retrieving data:', error);
    res.render('importrow', { message: 'Error retrieving data', databaseNames: [], tableNames: [], selectedDatabase: '' });
  }
});

// Define a route for the file upload handling
app.post('/upload', upload.single('csvFile'), async (req, res) => {
  try {
    const { path, originalname } = req.file;
    const tableName = originalname.replace(/\.[^/.]+$/, "");
    const databaseName = req.body.database;

    const rows = await parseCSV(path);
    await importData(rows, tableName, databaseName);
  
    fs.unlinkSync(path);
  
    const databaseNames = await getDatabaseNames();
    const tableNames = await getTableNames(databaseName);
    res.render('importrow', { message: `${originalname} imported successfully`, databaseNames, tableNames });
  } catch (error) {
    console.error('Error importing CSV:', error);
    const databaseNames = await getDatabaseNames();
    const tableNames = await getTableNames();
    res.render('importrow', { message: 'Error importing CSV', databaseNames, tableNames });
  }
});

// Function to get all database names from the MySQL server
async function getDatabaseNames() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query('SHOW DATABASES');
    const databaseNames = rows.map((row) => Object.values(row)[0]);
    return databaseNames;
  } finally {
    connection.release();
  }
}

// Function to get all table names from the MySQL database
async function getTableNames(databaseName = '') {
  const connection = await pool.getConnection();
  try {
    const query = databaseName ? `SHOW TABLES FROM ${databaseName}` : 'SHOW TABLES';
    const [rows] = await connection.query(query);
    const tableNames = rows.map((row) => Object.values(row)[0]);
    return tableNames;
  } finally {
    connection.release();
  }
}

// Function to parse the CSV file and return rows as an array of objects
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

// Function to import the data into the MySQL database
async function importData(rows, tableName, databaseName = '') {
  const connection = await pool.getConnection();
  try {
    await connection.query('START TRANSACTION');

    // Create the table with columns from the first row
    const columnNames = Object.keys(rows[0]);
    const createTableQuery = databaseName ? `CREATE TABLE IF NOT EXISTS ${databaseName}.${tableName} (${columnNames.map(name => `${name} VARCHAR(255)`).join(',')})` : `CREATE TABLE IF NOT EXISTS ${tableName} (${columnNames.map(name => `${name} VARCHAR(255)`).join(',')})`;
    await connection.query(createTableQuery);

    // Insert data into the table
    for (const row of rows) {
      const values = Object.values(row);
      const insertQuery = databaseName ? `INSERT INTO ${databaseName}.${tableName} (${columnNames.join(',')}) VALUES (${columnNames.map(() => '?').join(',')})` : `INSERT INTO ${tableName} (${columnNames.join(',')}) VALUES (${columnNames.map(() => '?').join(',')})`;
      await connection.query(insertQuery, values);
    }

    await connection.query('COMMIT');
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    connection.release();
  }
}

// Start the server
app.listen(7000, () => {  
  console.log('Server is running on port 7000');
});
