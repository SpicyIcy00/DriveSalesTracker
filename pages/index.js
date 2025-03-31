import React, { useState } from 'react';
import axios from 'axios';

const defaultStores = [
  { name: 'Rockwell', tab: 'Rockwell' },
  { name: 'Greenhills', tab: 'Greenhills' },
  { name: 'Magnolia', tab: 'Magnolia' },
  { name: 'North Edsa', tab: 'North Edsa' },
  { name: 'Fairview', tab: 'Fairview' },
];

export default function Home() {
  const [stores, setStores] = useState(defaultStores);
  const [statuses, setStatuses] = useState({});
  const [autoUpdate, setAutoUpdate] = useState(true);

  const handleFileChange = (index, file) => {
    const updated = [...stores];
    updated[index].file = file;
    setStores(updated);
    setStatuses((prev) => ({ ...prev, [index]: 'Ready' }));
  };

  const processAll = async () => {
    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      if (!store.file) continue;

      setStatuses((prev) => ({ ...prev, [i]: 'Uploading...' }));
      const formData = new FormData();
      formData.append('store', store.name);
      formData.append('file', store.file);

      try {
        await axios.post('/api/upload', formData);
        setStatuses((prev) => ({ ...prev, [i]: '✅ Success' }));
      } catch (err) {
        setStatuses((prev) => ({ ...prev, [i]: '❌ Failed' }));
      }
    }
  };

  const addStore = () => {
    const name = prompt('Store name?');
    const tab = prompt('Google Sheets tab name?');
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
    <div className="min-h-screen bg-[#0f172a] text-white p-8">
      <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">📊 Sales Data Processor</h1>
      <p className="text-blue-200 bg-blue-900 px-4 py-2 rounded mb-6">
        📂 Upload sales data files for each store. The processed data will be automatically updated in the corresponding Google Sheet tab.
      </p>

      <div className="mb-4">
        <label className="inline-flex items-center">
          <input
            type="checkbox"
            checked={autoUpdate}
            onChange={() => setAutoUpdate(!autoUpdate)}
            className="mr-2"
          />
          Update Google Sheets after processing
        </label>
      </div>

      <div className="bg-gray-800 shadow-xl rounded-xl p-6 mb-6 border border-gray-700">
        <h2 className="text-xl font-semibold mb-4">⬆️ Upload Files for Processing</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border border-gray-700">
            <thead className="bg-gray-700 text-gray-200">
              <tr>
                <th className="p-3 border border-gray-600">Store</th>
                <th className="p-3 border border-gray-600">Sheet Tab</th>
                <th className="p-3 border border-gray-600">Upload File</th>
                <th className="p-3 border border-gray-600">Status</th>
                <th className="p-3 border border-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store, index) => (
                <tr
                  key={index}
                  className="even:bg-gray-800 odd:bg-gray-900 hover:bg-gray-700 transition"
                >
                  <td className="p-3 border border-gray-700 font-semibold">{store.name}</td>
                  <td className="p-3 border border-gray-700">{store.tab}</td>
                  <td className="p-3 border border-gray-700">
                    <input
                      type="file"
                      onChange={(e) => handleFileChange(index, e.target.files[0])}
                      className="text-sm"
                    />
                  </td>
                  <td className="p-3 border border-gray-700">
                    <span
                      className={`font-medium ${
                        statuses[index]?.includes('Success') ? 'text-green-400' :
                        statuses[index]?.includes('Failed') ? 'text-red-400' :
                        'text-gray-400'
                      }`}
                    >
                      {statuses[index] || 'No file selected'}
                    </span>
                  </td>
                  <td className="p-3 border border-gray-700">
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
      </div>

      <div className="mt-6 flex gap-4">
        <button
          onClick={processAll}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded flex items-center gap-2"
        >
          ⚙️ Process All Files
        </button>
        <button
          onClick={addStore}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center gap-2"
        >
          ➕ Add Store
        </button>
      </div>

      <footer className="mt-10 text-sm text-center text-gray-500">
        Sales Data Processor © 2025
      </footer>
    </div>
  );
}
