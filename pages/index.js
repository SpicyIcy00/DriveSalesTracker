import React, { useState } from "react";

export default function Home() {
  const [stores, setStores] = useState([
    { name: "Rockwell", tab: "Rockwell", file: null, status: "Not uploaded" },
    { name: "Greenhills", tab: "Greenhills", file: null, status: "Not uploaded" },
    { name: "Magnolia", tab: "Magnolia", file: null, status: "Not uploaded" },
    { name: "North Edsa", tab: "North Edsa", file: null, status: "Not uploaded" },
    { name: "Fairview", tab: "Fairview", file: null, status: "Not uploaded" },
  ]);

  const [loading, setLoading] = useState(false);

  const handleFileChange = (file, index) => {
    const updated = [...stores];
    updated[index].file = file;
    setStores(updated);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file, index);
  };

  const processAll = async () => {
    setLoading(true);
    const updatedStores = [...stores];

    for (let i = 0; i < updatedStores.length; i++) {
      const store = updatedStores[i];

      if (!store.file) {
        updatedStores[i].status = "No file";
        continue;
      }

      const formData = new FormData();
      formData.append("file", store.file);
      formData.append("sheetTab", store.tab);

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          updatedStores[i].status = "Success";
        } else {
          updatedStores[i].status = "Failed";
        }
      } catch (err) {
        updatedStores[i].status = "Failed";
      }
    }

    setStores(updatedStores);
    setLoading(false);
  };

  const removeStore = (index) => {
    const updated = [...stores];
    updated.splice(index, 1);
    setStores(updated);
  };

  const addStore = () => {
    setStores([
      ...stores,
      { name: "", tab: "", file: null, status: "Not uploaded" },
    ]);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
          📊 Sales Data Processor
        </h1>

        <p className="bg-blue-900 p-4 rounded mb-4 text-sm border border-blue-500">
          📥 Upload sales data files for each store. The processed data will be automatically updated in the corresponding Google Sheet tab.
        </p>

        <label className="flex items-center gap-2 mb-4">
          <input type="checkbox" checked readOnly />
          <span>Update Google Sheets after processing</span>
        </label>

        <table className="w-full table-auto text-sm border border-gray-500 mb-4">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left">Store</th>
              <th className="px-4 py-2 text-left">Sheet Tab</th>
              <th className="px-4 py-2 text-left">Upload File</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store, index) => (
              <tr key={index} className="border-t border-gray-600">
                <td className="px-4 py-2">{store.name}</td>
                <td className="px-4 py-2">{store.tab}</td>
                <td
                  className="px-4 py-2 border border-dashed border-gray-400 rounded text-center cursor-pointer"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  <input
                    type="file"
                    className="hidden"
                    id={`file-${index}`}
                    onChange={(e) =>
                      handleFileChange(e.target.files[0], index)
                    }
                  />
                  <label htmlFor={`file-${index}`} className="cursor-pointer">
                    📤 {store.file ? store.file.name : "Choose File"}
                  </label>
                </td>
                <td className="px-4 py-2">
                  {store.status === "Success" ? "✅" : store.status === "Failed" ? "❌ Failed" : store.status}
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => removeStore(index)}
                    className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-white"
                  >
                    ❌ Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center gap-4">
          <button
            onClick={processAll}
            disabled={loading}
            className={`px-6 py-2 rounded font-medium flex items-center gap-2 ${
              loading ? "bg-gray-500 cursor-wait" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            ⚙️ {loading ? "Processing..." : "Process All Files"}
            {loading && (
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
            )}
          </button>

          <button
            onClick={addStore}
            className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded font-medium text-white"
          >
            ➕ Add Store
          </button>
        </div>

        <footer className="text-center mt-16 text-gray-400 text-sm">
          Sales Data Processor © 2025
        </footer>
      </div>
    </div>
  );
}
