import formidable from "formidable";
import fs from "fs/promises";
import { google } from "googleapis";
import { parse } from "csv-parse/sync";
import xlsx from "xlsx";
import path from "path";

export const config = {
  api: { bodyParser: false },
};

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

  const sortedCategories = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

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
    if (err) {
      console.error("❌ Form parse error:", err);
      return res.status(500).json({ error: "File upload failed." });
    }

    console.log("📝 Parsed fields:", fields);
    console.log("📝 Parsed files:", files);

    try {
      const file = files.file?.[0];
      const tabName = fields.sheetTab?.[0];

      if (!file || !tabName) {
        console.error("❌ Missing file or sheetTab", { file, tabName });
        return res.status(400).json({ error: "Missing file or sheetTab." });
      }

      const rawData = await parseFile(file.filepath);
      const formatted = formatData(rawData);

      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || "{}");
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const authClient = await auth.getClient();
      const sheets = google.sheets({ version: "v4", auth: authClient });

      const spreadsheetId = process.env.SPREADSHEET_ID;
      console.log("📄 Writing to spreadsheet:", spreadsheetId, "Tab:", tabName);

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tabName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: formatted },
      });

      res.status(200).json({ message: "Success" });
    } catch (e) {
      console.error("❌ Upload error:", e);
      res.status(500).json({ error: e.message || "Upload error" });
    }
  });
}
