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
  const form = formidable({ keepExtensions: true });
  form.parse(req, async (err, fields, files) => {
    try {
      const file = files.file[0];
      const tabName = fields.store[0];

      let data = [];
      if (file.originalFilename.endsWith('.csv')) {
        const content = await fs.readFile(file.filepath);
        data = parse(content, { columns: true });
      } else {
        const workbook = xlsx.readFile(file.filepath);
        data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      }

      const grouped = {};
      for (const row of data) {
        const category =
          row['Product Category'] ||
          row['product category'] ||
          row['PRODUCT CATEGORY'] ||
          'Uncategorized';
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(row);
      }

      const finalRows = [['Product Name', 'Product Category', 'Total Items Sold']];
      for (const category of Object.keys(grouped)) {
        const sorted = grouped[category].sort((a, b) => {
          const aSold = Math.floor(
            a['Total Items Sold'] || a['total items sold'] || a['TOTAL ITEMS SOLD'] || 0
          );
          const bSold = Math.floor(
            b['Total Items Sold'] || b['total items sold'] || b['TOTAL ITEMS SOLD'] || 0
          );
          return bSold - aSold;
        });

        for (const item of sorted) {
          const name =
            item['Product Name'] || item['product name'] || item['PRODUCT NAME'] || 'Unknown Product';
          const cat =
            item['Product Category'] ||
            item['product category'] ||
            item['PRODUCT CATEGORY'] ||
            'Uncategorized';
          const sold = Math.floor(
            item['Total Items Sold'] || item['total items sold'] || item['TOTAL ITEMS SOLD'] || 0
          );
          finalRows.push([name.toString().trim(), cat.toString().trim(), sold]);
        }
        finalRows.push(['', '', '']);
      }

      const authClient = await auth.getClient();
      const sheets = google.sheets({ version: 'v4', auth: authClient });

      // Write values to the sheet
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${tabName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: finalRows },
      });

      const rowCount = finalRows.length;

      // Step 1: Clear existing banding to avoid error
      const { data: { sheets: sheetMeta } } = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        ranges: [],
        includeGridData: false,
      });

      const sheetInfo = sheetMeta.find(s => s.properties.title === tabName);
      const sheetIdNum = sheetInfo.properties.sheetId;

      const bandingRequests = [];

      // If there's existing banding, remove it
      if (sheetInfo.bandedRanges?.length) {
        for (const band of sheetInfo.bandedRanges) {
          bandingRequests.push({ deleteBanding: { bandedRangeId: band.bandedRangeId } });
        }
      }

      // Add the new formatting requests
      bandingRequests.push(
        {
          repeatCell: {
            range: {
              sheetId: sheetIdNum,
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
                sheetId: sheetIdNum,
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
        }
      );

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: bandingRequests,
        },
      });

      await fs.unlink(file.filepath);
      res.status(200).json({ message: 'Uploaded and formatted successfully!' });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ message: 'Upload failed', error });
    }
  });
}
