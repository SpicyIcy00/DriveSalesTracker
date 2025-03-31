// pages/index.js

import React, { useState } from "react";
import axios from "axios";

const defaultStores = [
  { name: "Rockwell", tab: "Rockwell" },
  { name: "Greenhills", tab: "Greenhills" },
  { name: "Magnolia", tab: "Magnolia" },
  { name: "North Edsa", tab: "North Edsa" },
  { name: "Fairview", tab: "Fairview" },
];

export default function Home() {
  const [stores, setStores] = useState(defaultStores);
  const [statuses, setStatuses] = useState({});
  const [autoUpdate, setAutoUpdate] = useState(true);

  const handleFileChange = (index, file) => {
    const updated = [...stores];
    updated[index].file = file;
    setStores(updated);
    setStatuses((prev) => ({ ...prev, [index]: "Ready" }));
  };

  const processAll = async () => {
    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      if (!store.file) continue;

      setStatuses((prev) => ({ ...prev, [i]: "Uploading..." }));
      const formData = new FormData();
      formData.append("store", store.name);
      formData.append("file", store.file);

      try {
        await axios.post("/api/upload", formData);
        setStatuses((prev) => ({ ...prev, [i]: "✅ Success" }));
      } catch (err) {
        setStatuses((prev) => ({ ...prev, [i]: "❌ Failed" }));
      }
    }
  };

  const addStore = () => {
    const name = prompt("Store name?");
    const tab = prompt("Google Sheets tab name?");
    if (name && tab) {
      setStores([...stores, { name, tab }]);
    }
  };

  const deleteStore = (index) => {
    const updated = [...stores];
    updated.splice(index, 1);
    setStores(updated);
    const newStatuses = { ...statuses };
    delete newStatuses[index];
    setStatuses(newStatuses);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">📊 Sales Data Processor</h1>

        <div className="bg-slate-800 border border-blue-400 text-blue-100 p-4 rounded mb-6">
          📂 Upload sales data files for each store. The processed data will be automatically updated in the corresponding Google Sheet tab.
        </div>

        <label className="inline-flex items-center mb-4">
          <input
            type="checkbox"
            checked={autoUpdate}
            onChange={() => setAutoUpdate(!autoUpdate)}
            className="mr-2"
          />
          Update Google Sheets after processing
        </label>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-slate-600">
            <thead className="bg-slate-700">
              <tr>
                <th className="p-2 border">Store</th>
                <th className="p-2 border">Sheet Tab</th>
                <th className="p-2 border">Upload File</th>
                <th className="p-2 border">Status</th>
                <th className="p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store, index) => (
                <tr key={index} className="even:bg-slate-800 odd:bg-slate-700">
                  <td className="p-2 border font-semibold">{store.name}</td>
                  <td className="p-2 border">{store.tab}</td>
                  <td className="p-2 border">
                    <input
                      type="file"
                      onChange={(e) => handleFileChange(index, e.target.files[0])}
                      className="text-sm"
                    />
                  </td>
                  <td className="p-2 border">{statuses[index] || "No file selected"}</td>
                  <td className="p-2 border">
                    <button
                      onClick={() => deleteStore(index)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                    >
                      ✖ Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex gap-4">
          <button
            onClick={processAll}
            className="bg-indigo-500 hover:bg-indigo-600 px-6 py-2 rounded text-white font-semibold"
          >
            ⚙️ Process All Files
          </button>
          <button
            onClick={addStore}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white"
          >
            ➕ Add Store
          </button>
        </div>

        <footer className="mt-10 text-sm text-center text-gray-400">
          Sales Data Processor © 2025
        </footer>
      </div>
    </div>
  );
}
