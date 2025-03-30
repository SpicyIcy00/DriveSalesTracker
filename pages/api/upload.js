
import formidable from 'formidable';
import fs from 'fs';
import { google } from 'googleapis';
import { parse } from 'csv-parse/sync';
import xlsx from 'xlsx';

export const config = {
  api: {
    bodyParser: false,
  },
};

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheetId = '1m-qaKoNWJdDWtl0bWuqnLEuF7KENQYRmspIX5BdBTHM';

export default async function handler(req, res) {
  const form = new formidable.IncomingForm({ keepExtensions: true });
  form.parse(req, async (err, fields, files) => {
    const file = files.file[0];
    const tabName = fields.store[0];

    let data = [];
    if (file.originalFilename.endsWith('.csv')) {
      const content = fs.readFileSync(file.filepath);
      data = parse(content, { columns: true });
    } else {
      const workbook = xlsx.readFile(file.filepath);
      data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    }

    const grouped = {};
    for (const row of data) {
      const category = row['Product Category'];
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(row);
    }

    const finalRows = [];
    for (const category of Object.keys(grouped)) {
      const sorted = grouped[category].sort((a, b) => b['Total Items Sold'] - a['Total Items Sold']);
      for (const item of sorted) {
        finalRows.push([
          item['Product Name'],
          item['Product Category'],
          Math.floor(item['Total Items Sold']),
        ]);
      }
      if (i !== categoryKeys.length - 1) finalRows.push(['', '', '']);
    }

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tabName}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [
  [`Processed at ${new Date().toLocaleString()}`],
  ['Product Name', 'Product Category', 'Total Items Sold'],
  ...finalRows
],
      },
    });

    fs.unlinkSync(file.filepath);
    res.status(200).json({ message: 'Uploaded and formatted successfully' });
  });
}
