import { formidable } from 'formidable';
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
  const form = formidable({ keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'File parsing failed' });

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
      const category = (row['Product Category'] || '').trim();
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(row);
    }

    const finalRows = [
      ['Product Name', 'Product Category', 'Total Items Sold']
    ];

    const sortedCategories = Object.keys(grouped).sort();
    sortedCategories.forEach((category, i) => {
      const sorted = grouped[category].sort((a, b) => b['Total Items Sold'] - a['Total Items Sold']);
      for (const item of sorted) {
        finalRows.push([
          item['Product Name'] || '',
          item['Product Category'] || '',
          Math.floor(item['Total Items Sold'] || 0)
        ]);
      }
      if (i !== sortedCategories.length - 1) {
        finalRows.push(['', '', '']); // empty row between categories
      }
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // Clear old values
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: `${tabName}!A1:Z1000`,
    });

    // Write data with headers
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tabName}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: finalRows,
      },
    });

    // Get sheetId + banded ranges
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === tabName);
    const sheetIdNum = sheet?.properties?.sheetId;
    const existingBands = sheet?.bandedRanges || [];

    // Delete existing banded rows
    const deleteBandingRequests = existingBands.map(band => ({
      deleteBanding: { bandedRangeId: band.bandedRangeId }
    }));

    // Apply borders and alternating rows
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          ...deleteBandingRequests,
          {
            repeatCell: {
              range: {
                sheetId: sheetIdNum,
                startRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 3
              },
              cell: {
                userEnteredFormat: {
                  borders: {
                    top: { style: 'SOLID', color: { red: 0, green: 0, blue: 0 } },
                    bottom: { style: 'SOLID', color: { red: 0, green: 0, blue: 0 } },
                    left: { style: 'SOLID', color: { red: 0, green: 0, blue: 0 } },
                    right: { style: 'SOLID', color: { red: 0, green: 0, blue: 0 } }
                  }
                }
              },
              fields: 'userEnteredFormat.borders'
            }
          },
          {
            addBanding: {
              bandedRange: {
                range: {
                  sheetId: sheetIdNum,
                  startRowIndex: 1,
                  endRowIndex: finalRows.length,
                  startColumnIndex: 0,
                  endColumnIndex: 3
                },
                rowProperties: {
                  headerColor: { red: 0.85, green: 0.9, blue: 0.95 },
                  firstBandColor: { red: 0.94, green: 0.94, blue: 0.94 },
                  secondBandColor: { red: 1, green: 1, blue: 1 }
                }
              }
            }
          }
        ]
      }
    });

    fs.unlinkSync(file.filepath);
    res.status(200).json({ message: 'Uploaded and formatted successfully' });
  });
}
