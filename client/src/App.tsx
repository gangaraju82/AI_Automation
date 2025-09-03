import { useState } from "react";
import "./App.css";
import TestFileDropdown from "./components/testFiles";

export default function App() {
  const [prompt, setPrompt] = useState(
    "Launch https://saucedemo.com, login with standard_user/secret_sauce, add 1 product to cart and verify 1 product added in cart"
  );

  const [reportUrl, setReportUrl] = useState(
    "http://localhost:4000/report/index.html"
  );

  const [grep, setGrep] = useState("login");
  const [selectedFile, setSelectedFile] = useState("");
  const [filename, setFilename] = useState("saucedemo");
  const [baseURL, setBaseURL] = useState("https://www.saucedemo.com/");
  const [log, setLog] = useState("");

  async function call(path: string, body?: any) {
    const r = await fetch(`http://localhost:4000${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return r.json();
  }

  async function onGenerate() {
    const j = await call("/api/generate", { prompt, filename, baseURL });
    setLog((prev) => prev + "\nGenerated: " + JSON.stringify(j, null, 2));
  }

  async function onRun() {
    console.log("selected file,", selectedFile);
    const j = await call("/api/run", { selectedFile, grep, baseURL });
    setLog((prev) => prev + "\nRun: " + JSON.stringify(j, null, 2));
  }

  async function onReport() {
    const j = await call("/api/report", { grep: "Gmail login" });
    setLog((prev) => prev + "\nReport: " + JSON.stringify(j, null, 2));
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-10 px-4">
  <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8 space-y-8">
    {/* Title */}
   <div className="text-4xl font-extrabold text-white text-center bg-blue-600 py-8 px-4 rounded-lg shadow-md">
        <h1>Test Automation Demo</h1>
      </div>

    {/* Base URL */}
    {/* <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        Base URL
      </label>
      <input
        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
        value={baseURL}
        onChange={(e) => setBaseURL(e.target.value)}
        placeholder="http://localhost:3000"
      />
    </div> */}

    {/* Test filename */}
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        Test Title
      </label>
      <input
        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
        value={filename}
        onChange={(e) => setFilename(e.target.value.replaceAll(" ", "_"))}
        placeholder="example.spec.ts"
      />
    </div>

    {/* Prompt */}
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        Prompt
      </label>
      <textarea
        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 h-40 resize-none"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the test you want to generate..."
      />
    </div>

    {/* Buttons */}
    <div className="flex flex-col sm:flex-row gap-4">
      <button
        className=" px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold shadow-md transition"
        onClick={onGenerate}
      >
        ✨ Generate Test
      </button>

      
    </div>

    {/* Test Runner Section */}
    <div className="bg-gray-100 rounded-xl p-6 space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">Test Runner</h2>
      <TestFileDropdown onSelect={setSelectedFile} />
      <p className="text-sm text-gray-600">
        Selected:{" "}
        <span className="font-semibold text-indigo-600">
          {selectedFile || "None"}
        </span>
      </p>
    </div>

     {/* Buttons */}
    <div className="flex flex-col sm:flex-row gap-4">

    <button
        className="px-6 py-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold shadow-md transition"
        onClick={onRun}
      >
        ▶ Run Test
      </button>
    </div>

    {/* Logs */}
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-2">Logs</h2>
      <pre className="text-xs bg-gray-900 text-green-300 p-4 rounded-lg whitespace-pre-wrap overflow-x-auto max-h-80">
        {log || "Logs will appear here..."}
      </pre>
    </div>

    {/* Report */}
    <div className="bg-indigo-50 rounded-xl p-6 flex items-center justify-between">
      <h2 className="text-xl font-bold text-indigo-800">📊 Playwright Allure Report</h2>
      <a
        href={reportUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md transition"
      >
        Open Report
      </a>
    </div>
  </div>
</div>
    </>
  );
}
{
  /* <button onClick={onReport} className="px-4 py-2 rounded bg-green-600 text-white">Build Report</button> */
}
