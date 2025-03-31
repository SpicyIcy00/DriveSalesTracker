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
  const form = formidable();
  const [fields, files] = await form.parse(req);

  const file = files.file[0];
  const tabName = fields.store[0];

  let data = [];
  if (file.originalFilename.endsWith('.csv')) {
    const content = await fs.readFile(file.filepath);
    data = parse(content, { columns: true });
  } else {
    const workbook = xlsx.readFile(file.filepath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    data = xlsx.utils.sheet_to_json(sheet);
  }

  // Robust field name detection
  const grouped = {};
  for (const item of data) {
    const nameKey = Object.keys(item).find(k => k.toLowerCase().includes('product') && k.toLowerCase().includes('name'));
    const catKey = Object.keys(item).find(k => k.toLowerCase().includes('category'));
    const soldKey = Object.keys(item).find(k => k.toLowerCase().includes('sold'));

    const name = nameKey ? item[nameKey]?.toString().trim() : 'Unknown Product';
    const cat = catKey ? item[catKey]?.toString().trim() : 'Uncategorized';
    const sold = soldKey ? Math.floor(item[soldKey] || 0) : 0;

    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ name, cat, sold });
  }

  const finalRows = [['Product Name', 'Product Category', 'Total Items Sold']];
  for (const category of Object.keys(grouped)) {
    const sorted = grouped[category].sort((a, b) => b.sold - a.sold);
    for (const item of sorted) {
      finalRows.push([item.name, item.cat, item.sold]);
    }
    finalRows.push(['', '', '']); // Empty row between categories
  }

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  // Write the values
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${tabName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: finalRows },
  });

  // Get number of rows to apply styles
  const rowCount = finalRows.length;

  // Apply alternating color bands and borders
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: rowCount,
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
                  sheetId: 0,
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
  } catch (err) {
    console.warn('Formatting failed:', err.message);
  }

  res.status(200).json({ message: 'Uploaded and formatted successfully' });
}
