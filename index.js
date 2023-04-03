const _ = require('lodash');
const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');
const dotenv = require('dotenv');
const mysql2 = require('mysql2');

dotenv.config();

const db = mysql2.createConnection({
  host: `${process.env.MYSQL_HOST}`,
  user: `${process.env.MYSQL_USER}`,
  password: `${process.env.MYSQL_PASSWORD}`,
  database: `${process.env.MYSQL_DATABASE}`,
});

let lastSpreadsheetRecord;

db.connect((err) => {
  if (err) throw err;
  console.log('Connected to database');

  const schemaQuery = `CREATE SCHEMA IF NOT EXISTS ${process.env.MYSQL_DATABASE}`;
  db.query(schemaQuery, (err, result) => {
    if (err) throw err;
  });
  
  const tableQuery =`
  CREATE TABLE IF NOT EXISTS ${process.env.MYSQL_TABLE} (
    id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
    Student_Name VARCHAR(255) NOT NULL,
    Gender VARCHAR(255) NOT NULL,
    Class_Level VARCHAR(255) NOT NULL,
    Home_State VARCHAR(255) NOT NULL,
    Major VARCHAR(255) NOT NULL,
    Extracurricular_Activity VARCHAR(255) NOT NULL
  )
  `
  db.query(tableQuery, (err, result) => {
    if (err) throw err;
    console.log('Table created or exists!');
  });
});

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), './credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
async function listMajors(auth) {

  const sheets = google.sheets({version: 'v4', auth});
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: `${process.env.SPREADSHEET_ID}`,
    range: `!A:F`,
  });
  
  console.log('Last row entered: ', res.data.values[res.data.values.length - 1]);
  
  const rows = res.data.values;

  if (!rows || rows.length === 0) {
    console.log('No data found.');
    return;
  }

  lastSpreadsheetRecord = rows[rows.length - 1];

  // Get the last row from the database
  const selectQuery = `SELECT * FROM ${process.env.MYSQL_TABLE} ORDER BY id DESC LIMIT 1`;

  db.query(selectQuery, (err, result) => {
    if (err) console.log('Select query error: ', err);

    if (!_.isEmpty(result)) {
      console.log('last row returned: ', result[0]);
      const lastRow = Object.values(result[0]);
      lastRow.shift();
      console.log('last row: ', lastRow);

      if (lastRow.every((value, index) => value === lastSpreadsheetRecord[index])) {
        console.log('No new entries in the spreadsheet document');
      } else {
        const insertRow = `
        INSERT INTO ${process.env.MYSQL_TABLE} 
        (Student_Name, Gender, Class_Level, Home_State, Major, Extracurricular_Activity)
        VALUES (?, ?, ?, ?, ?, ?)`;

        db.query(insertRow, [
          `${lastSpreadsheetRecord[0]}`,
          `${lastSpreadsheetRecord[1]}`,
          `${lastSpreadsheetRecord[2]}`,
          `${lastSpreadsheetRecord[3]}`,
          `${lastSpreadsheetRecord[4]}`,
          `${lastSpreadsheetRecord[5]}`],
          (err, result) => {
          if (err) console.log('InsertSingle query error: ', err);
          console.log('Database update with one row!');
                
        });        
      }
    } else {
      let count = 0;
      rows.forEach((row) => {
        // Print columns A and E, which correspond to indices 0 and 4.
        // console.log(`${row[0]}, ${row[1]}, ${row[2]}, ${row[3]}, ${row[4]}, ${row[5]}`);
        const insertQuery = `
          INSERT INTO ${process.env.MYSQL_TABLE}
          (Student_Name, Gender, Class_Level, Home_State, Major, Extracurricular_Activity)
          VALUES (?, ?, ?, ?, ?, ?)`;
    
        db.query(insertQuery, [
          `${row[0]}`,
          `${row[1]}`,
          `${row[2]}`,
          `${row[3]}`,
          `${row[4]}`,
          `${row[5]}`],
          (err, result) => {
          if (err) console.log('insertQuery error: ', err);
          count++;
        });
      });
      console.log(`${count} records inserted into the Database.`);
    }
  });
}

// Set up interval to periodically check for new rows in the Google Spreadsheet
setInterval(() => {
  authorize().then(listMajors).catch(console.error);
}, 20000);
