import { useEffect, useState } from "react";

export default function TestFileDropdown({ onSelect }: { onSelect: (file: string) => void }) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState("");

   useEffect(() => {
    fetch("http://localhost:4000/api/tests")
      .then(res => res.json())
      .then(data => {
        if (data.ok) setFiles(data.files);
      })
      .catch(err => console.error("Failed to fetch test files:", err));
  }, []);

  return (
    <div className="w-full max-w-sm mx-auto">
      <label className="block mb-2 text-sm font-medium text-gray-700">
        Select Test File
      </label>
      <select
        value={selected}
        onChange={(e) => {
          setSelected(e.target.value);
          onSelect(e.target.value);
        }}
        className="w-full border rounded-lg p-2 bg-white shadow-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
      >
        <option value="">-- Choose a file --</option>
        {files.map((file) => (
          <option key={file} value={file}>
            {file}
          </option>
        ))}
      </select>
    </div>
  );
}
