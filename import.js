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
  database: 'demo',
});

// Create an Express application
const app = express();

// Set up Multer for file upload
const upload = multer({ dest: 'uploads/' });

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Define a route for the file upload form
app.get('/', (req, res) => {
  res.render('import', { message: null });
});

// Define a route for the file upload handling
app.post('/upload', upload.single('csvFile'), async (req, res) => {
  try {
    const { path, originalname } = req.file;
    console.log('Original name:', originalname);
    
    const tableName = originalname.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9_]/gi, "_");
    // Remove file extension from the name

    // Read the CSV file and process the data
    const rows = await parseCSV(path);

    // Import the data into the MySQL database with the dynamic table name
    await importData(rows, tableName);

    // Delete the temporary file
    fs.unlinkSync(path);

    res.render('import', { message: `${originalname} file imported successfully` });
  } catch (error) {
    console.error('Error importing CSV:', error);
    res.render('import', { message: 'Error importing CSV' });
  }
});

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
async function importData(rows, tableName) {
  const connection = await pool.getConnection();
  try {
    await connection.query('START TRANSACTION');

    // Create the table with columns from the first row
  // Create the table with columns from the first row
const columnNames = Object.keys(rows[0]);
const columnDefinitions = columnNames.map(name => `\`${name}\` VARCHAR(255)`).join(',');
await connection.query(`CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefinitions})`);


    // Insert data into the table
    // Insert data into the table
for (const row of rows) {
    const columnNames = Object.keys(row);
    const values = Object.values(row);
    const columnDefinitions = columnNames.map(name => `\`${name}\``).join(',');
    const placeholders = columnNames.map(() => '?').join(',');
    await connection.query(`INSERT INTO ${tableName} (${columnDefinitions}) VALUES (${placeholders})`, values);
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
app.listen(4000, () => {
  console.log('Server is running on port 4000');
});
