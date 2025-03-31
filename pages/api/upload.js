import { IncomingForm } from 'formidable';
import { google } from 'googleapis';
import { parse } from 'csv-parse/sync';
import xlsx from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export const config = {
  api: {
    bodyParser: false,
  },
};

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SHEET_ID = '1m-qaKoNWJdDWtl0bWuqnLEuF7KENQYRmspIX5BdBTHM';

export default async function handler(req, res) {
  const form = new IncomingForm({ multiples: false, uploadDir: os.tmpdir(), keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parse error:', err);
      return res.status(500).json({ error: 'Error parsing form' });
    }

    try {
      const file = files.file;
      const tabName = fields.store;

      if (!file || !tabName) {
        return res.status(400).json({ error: 'Missing file or store name' });
      }

      let data = [];

      const buffer = await fs.readFile(file.filepath);

      if (file.originalFilename.endsWith('.csv')) {
        data = parse(buffer.toString(), { columns: true });
      } else {
        const workbook = xlsx.read(buffer);
        data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      }

      const grouped = {};
      for (const row of data) {
        const cat = row['Product Category'];
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(row);
      }

      const finalRows = [['Product Name', 'Product Category', 'Total Items Sold']];
      for (const category of Object.keys(grouped)) {
        const sorted = grouped[category].sort((a, b) => b['Total Items Sold'] - a['Total Items Sold']);
        for (const item of sorted) {
          finalRows.push([
            item['Product Name'],
            item['Product Category'],
            Math.floor(item['Total Items Sold']),
          ]);
        }
        finalRows.push(['', '', '']);
      }

      finalRows.unshift([`Processed at ${new Date().toLocaleString()}`, '', '']);

      const authClient = await auth.getClient();
      const sheets = google.sheets({ version: 'v4', auth: authClient });

      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${tabName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: finalRows,
        },
      });

      res.status(200).json({ message: 'Upload successful and Google Sheet updated!' });
    } catch (e) {
      console.error('Upload error:', e);
      res.status(500).json({ error: 'Failed to process file.' });
    }
  });
}
