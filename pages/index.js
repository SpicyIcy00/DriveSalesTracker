
import React, { useState } from 'react';
import axios from 'axios';

export default function Home() {
  const [stores, setStores] = useState([
    { name: 'Rockwell', tab: 'Rockwell' },
    { name: 'Greenhills', tab: 'Greenhills' },
    { name: 'Magnolia', tab: 'Magnolia' },
    { name: 'North Edsa', tab: 'North Edsa' },
    { name: 'Fairview', tab: 'Fairview' },
  ]);
  const [statuses, setStatuses] = useState({});

  const handleFileChange = (index, file) => {
    const updated = [...stores];
    updated[index].file = file;
    setStores(updated);
    setStatuses((prev) => ({ ...prev, [index]: 'Ready' }));
  };

  const addStore = () => {
    const name = prompt('Store name?');
    const tab = prompt('Sheet tab name?');
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

  const processAll = async () => {
    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      if (!store.file) continue;

      setStatuses((prev) => ({ ...prev, [i]: 'Uploading...' }));
      const formData = new FormData();
      formData.append('store', store.tab);
      formData.append('file', store.file);

      try {
        await axios.post('/api/upload', formData);
        setStatuses((prev) => ({ ...prev, [i]: '✅ Success' }));
      } catch (err) {
        setStatuses((prev) => ({ ...prev, [i]: '❌ Failed' }));
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-8">
      <h1 className="text-2xl font-bold mb-6">📊 Drive Sales Tracker</h1>
      <div className="bg-blue-900 text-blue-100 p-4 rounded mb-6">
        Upload sales data per store. Processed data will be formatted and sent to your Google Sheets tab.
      </div>

      <table className="w-full text-sm border mb-6">
        <thead className="bg-gray-800">
          <tr>
            <th className="p-2 border">Store</th>
            <th className="p-2 border">Sheet Tab</th>
            <th className="p-2 border">File</th>
            <th className="p-2 border">Status</th>
            <th className="p-2 border">Action</th>
          </tr>
        </thead>
        <tbody>
          {stores.map((store, index) => (
            <tr key={index} className="even:bg-gray-700 odd:bg-gray-800">
              <td className="p-2 border">{store.name}</td>
              <td className="p-2 border">{store.tab}</td>
              <td className="p-2 border">
                <input type="file" onChange={(e) => handleFileChange(index, e.target.files[0])} />
              </td>
              <td className="p-2 border">{statuses[index] || '—'}</td>
              <td className="p-2 border">
                <button onClick={() => deleteStore(index)} className="bg-red-600 px-2 rounded">
                  ✖
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex gap-4">
        <button
          onClick={processAll}
          className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded text-white"
        >
          ⚙️ Process All
        </button>
        <button
          onClick={addStore}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white"
        >
          ➕ Add Store
        </button>
      </div>
    </div>
  );
}
