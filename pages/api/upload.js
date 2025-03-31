import formidable from 'formidable';
import fs from 'fs/promises';
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
    try {
      const file = files.file[0];
      const tabName = fields.store[0];

      // Parse data
      let data = [];
      if (file.originalFilename.endsWith('.csv')) {
        const content = await fs.readFile(file.filepath);
        data = parse(content, { columns: true });
      } else {
        const workbook = xlsx.readFile(file.filepath);
        data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      }

      // Group and sort
      const grouped = {};
      for (const row of data) {
        const category = row['Product Category'];
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(row);
      }

      const finalRows = [['Product Name', 'Product Category', 'Total Items Sold']];
      for (const category of Object.keys(grouped)) {
        const sorted = grouped[category].sort((a, b) => b['Total Items Sold'] - a['Total Items Sold']);
        for (const item of sorted) {
          finalRows.push([
            item['Product Name'] || '',
            item['Product Category'] || '',
            Math.floor(item['Total Items Sold']) || 0,
          ]);
        }
        finalRows.push(['', '', '']);
      }

      // Auth
      const authClient = await auth.getClient();
      const sheets = google.sheets({ version: 'v4', auth: authClient });

      // Upload values
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${tabName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: finalRows,
        },
      });

      // Apply formatting
      const totalRows = finalRows.length;
      const requests = [];

      // Borders
      requests.push({
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 0,
            endRowIndex: totalRows,
            startColumnIndex: 0,
            endColumnIndex: 3,
          },
          cell: {
            userEnteredFormat: {
              borders: {
                top: { style: 'SOLID', color: { red: 0, green: 0, blue: 0 } },
                bottom: { style: 'SOLID', color: { red: 0, green: 0, blue: 0 } },
                left: { style: 'SOLID', color: { red: 0, green: 0, blue: 0 } },
                right: { style: 'SOLID', color: { red: 0, green: 0, blue: 0 } },
              },
            },
          },
          fields: 'userEnteredFormat.borders',
        },
      });

      // Alternating colors (banding)
      if (totalRows > 2) {
        requests.push({
          addBanding: {
            bandedRange: {
              range: {
                sheetId: 0,
                startRowIndex: 1,
                endRowIndex: totalRows,
                startColumnIndex: 0,
                endColumnIndex: 3,
              },
              rowProperties: {
                headerColor: { red: 0.85, green: 0.9, blue: 0.95 },
                firstBandColor: { red: 0.94, green: 0.94, blue: 0.94 },
                secondBandColor: { red: 1, green: 1, blue: 1 },
              },
            },
          },
        });
      }

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests },
      });

      await fs.unlink(file.filepath);
      res.status(200).json({ message: 'Uploaded and formatted successfully' });
    } catch (e) {
      console.error('Upload error:', e);
      res.status(500).json({ error: 'Upload failed' });
    }
  });
}
