import React, { useState } from "react";
import { Upload, PlusCircle, Trash2, ArrowRightCircle } from "lucide-react";

const defaultStores = [
  { name: "Rockwell", tab: "Rockwell" },
  { name: "Greenhills", tab: "Greenhills" },
  { name: "Magnolia", tab: "Magnolia" },
  { name: "North Edsa", tab: "North Edsa" },
  { name: "Fairview", tab: "Fairview" },
];

export default function Home() {
  const [stores, setStores] = useState(defaultStores.map(store => ({ ...store, file: null, status: "Not uploaded" })));
  const [updateSheets, setUpdateSheets] = useState(true);

  const handleFileChange = (e, index) => {
    const newStores = [...stores];
    newStores[index].file = e.target.files[0];
    newStores[index].status = "Ready to upload";
    setStores(newStores);
  };

  const handleProcess = async () => {
    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      if (!store.file) continue;
      const formData = new FormData();
      formData.append("file", store.file);
      formData.append("sheetTab", store.tab);
      formData.append("update", updateSheets);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const newStores = [...stores];
      newStores[i].status = res.ok ? "Uploaded" : "Failed";
      setStores(newStores);
    }
  };

  const handleRemove = (index) => {
    const newStores = stores.filter((_, i) => i !== index);
    setStores(newStores);
  };

  const handleAddStore = () => {
    setStores([...stores, { name: "", tab: "", file: null, status: "Not uploaded" }]);
  };

  return (
    <div className="min-h-screen bg-[#fef6ec] py-10 px-6 text-[#3a2b2b]">
      <div className="max-w-5xl mx-auto bg-white border border-[#e9d5c9] rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">CSV Sales Data Organizer and Formatting</h1>

        <table className="w-full border border-[#e5cab9] rounded overflow-hidden mb-6">
          <thead>
            <tr className="bg-[#fdf0e3] text-left">
              <th className="p-3">Store</th>
              <th className="p-3">Sheet Tab</th>
              <th className="p-3">File</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store, i) => (
              <tr key={i} className="border-t border-[#e5cab9]">
                <td className="p-3">
                  <input
                    className="bg-transparent border-b border-gray-300 w-full focus:outline-none"
                    value={store.name}
                    onChange={(e) => {
                      const newStores = [...stores];
                      newStores[i].name = e.target.value;
                      setStores(newStores);
                    }}
                  />
                </td>
                <td className="p-3">
                  <input
                    className="bg-transparent border-b border-gray-300 w-full focus:outline-none"
                    value={store.tab}
                    onChange={(e) => {
                      const newStores = [...stores];
                      newStores[i].tab = e.target.value;
                      setStores(newStores);
                    }}
                  />
                </td>
                <td className="p-3">
                  <label className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-400 rounded cursor-pointer text-sm text-gray-600 hover:bg-gray-100">
                    <Upload className="w-4 h-4" />
                    <span>{store.file ? store.file.name : "Upload"}</span>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => handleFileChange(e, i)}
                      className="hidden"
                    />
                  </label>
                </td>
                <td className="p-3 text-sm">{store.status}</td>
                <td className="p-3">
                  <button
                    onClick={() => handleRemove(i)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              className="form-checkbox rounded"
              checked={updateSheets}
              onChange={(e) => setUpdateSheets(e.target.checked)}
            />
            <span className="text-sm">Update Google Sheets after processing</span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleProcess}
              className="flex items-center gap-2 bg-[#5f4b8b] text-white px-5 py-2 rounded-lg shadow hover:bg-[#4c3a70]"
            >
              <ArrowRightCircle className="w-5 h-5" /> Process All
            </button>
            <button
              onClick={handleAddStore}
              className="flex items-center gap-2 bg-[#b5c99a] text-black px-5 py-2 rounded-lg shadow hover:bg-[#a2b584]"
            >
              <PlusCircle className="w-5 h-5" /> Add Store
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
