import formidable from "formidable";
import fs from "fs/promises";
import { google } from "googleapis";
import path from "path";
import { parse } from "csv-parse/sync";
import xlsx from "xlsx";

export const config = {
  api: {
    bodyParser: false,
  },
};

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: SCOPES,
});

function parseFile(filePath) {
  const ext = path.extname(filePath);
  if (ext === ".csv") {
    return fs.readFile(filePath, "utf8").then((text) => parse(text, { columns: true }));
  } else {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return Promise.resolve(xlsx.utils.sheet_to_json(sheet));
  }
}

function formatData(data) {
  const cleaned = data
    .filter((row) => row["Product Category"] && row["Product Name"] && row["Total Items Sold"])
    .map((row) => ({
      name: row["Product Name"],
      category: row["Product Category"],
      sold: parseInt(row["Total Items Sold"], 10),
    }));

  const grouped = {};
  cleaned.forEach((item) => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  const sortedCategories = Object.keys(grouped).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  const rows = [["Product Name", "Product Category", "Total Items Sold"]];
  sortedCategories.forEach((category) => {
    const sorted = grouped[category].sort((a, b) => b.sold - a.sold);
    sorted.forEach((item) => {
      rows.push([item.name, item.category, item.sold]);
    });
    rows.push(["", "", ""]);
  });

  return rows;
}

export default async function handler(req, res) {
  const form = formidable({ multiples: false, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Form parsing failed" });

    try {
      const fileArray = files.file;
      const tabArray = fields.sheetTab;

      if (!fileArray || !tabArray) {
        return res.status(400).json({ error: "Missing file or sheetTab" });
      }

      const file = fileArray[0];
      const tabName = tabArray[0];

      const rawData = await parseFile(file.filepath);
      const formatted = formatData(rawData);

      const authClient = await auth.getClient();
      const sheets = google.sheets({ version: "v4", auth: authClient });

      const spreadsheetId = process.env.SPREADSHEET_ID;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tabName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: formatted },
      });

      const { data: sheetMeta } = await sheets.spreadsheets.get({
        spreadsheetId,
        includeGridData: false,
      });

      const sheet = sheetMeta.sheets.find((s) => s.properties.title === tabName);
      const sheetId = sheet.properties.sheetId;

      const requests = [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: formatted.length,
              startColumnIndex: 0,
              endColumnIndex: 3,
            },
            cell: {
              userEnteredFormat: {
                borders: {
                  top: { style: "SOLID", color: { red: 0, green: 0, blue: 0 } },
                  bottom: { style: "SOLID", color: { red: 0, green: 0, blue: 0 } },
                  left: { style: "SOLID", color: { red: 0, green: 0, blue: 0 } },
                  right: { style: "SOLID", color: { red: 0, green: 0, blue: 0 } },
                },
              },
            },
            fields: "userEnteredFormat.borders",
          },
        },
      ];

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });

      res.status(200).json({ message: "Success" });
    } catch (e) {
      console.error("Upload error:", e);
      res.status(500).json({ error: "Upload error" });
    }
  });
}
