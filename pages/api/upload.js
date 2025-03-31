import { IncomingForm } from 'formidable';
import { google } from 'googleapis';
import { parse } from 'csv-parse/sync';
import xlsx from 'xlsx';
import fs from 'fs/promises';
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
  const form = new IncomingForm({ uploadDir: os.tmpdir(), keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'File upload error' });

    try {
      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      const tabName = Array.isArray(fields.store) ? fields.store[0] : fields.store;

      const buffer = await fs.readFile(file.filepath);
      let rawData;

      if (file.originalFilename.endsWith('.csv')) {
        rawData = parse(buffer.toString(), { columns: true });
      } else {
        const workbook = xlsx.read(buffer);
        rawData = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      }

      const cleaned = rawData.filter((row) => {
        const name = (row['Product Name'] || '').toString().trim();
        const category = (row['Product Category'] || '').toString().trim();
        const sold = parseInt(row['Total Items Sold']);
        return name && category && !isNaN(sold);
      });

      const grouped = {};
      for (const row of cleaned) {
        const name = row['Product Name'].toString().trim();
        const category = row['Product Category'].toString().trim();
        const sold = Math.floor(row['Total Items Sold']);

        if (!grouped[category]) grouped[category] = [];
        grouped[category].push({ name, category, sold });
      }

      const finalRows = [['Product Name', 'Product Category', 'Total Items Sold']];

      for (const category of Object.keys(grouped)) {
        const sorted = grouped[category].sort((a, b) => b.sold - a.sold);
        for (const item of sorted) {
          finalRows.push([item.name, item.category, item.sold]);
        }
        finalRows.push(['', '', '']); // Empty row between categories
      }

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

      const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
      const sheetId = sheetInfo.data.sheets.find((s) => s.properties.title === tabName).properties.sheetId;
      const rowCount = finalRows.length;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 1,
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
            },
            {
              addBanding: {
                bandedRange: {
                  range: {
                    sheetId,
                    startRowIndex: 1,
                    endRowIndex: rowCount,
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
            },
          ],
        },
      });

      res.status(200).json({ message: 'Upload and formatting successful!' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong processing the sheet.' });
    }
  });
}
