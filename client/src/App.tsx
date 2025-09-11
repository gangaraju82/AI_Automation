import { useState, useEffect } from "react";
import "./App.css";
import TestFileDropdown from "./components/testFiles";
import { Spinner } from "./components/Spinner";

export default function App() {
  const [prompt, setPrompt] = useState(
    "Launch https://www.saucedemo.com/ and login with username 'standard_user' and password 'secret_sauce'. Verify that the login is successful and the user is redirected to the inventory page. add 2 products to the cart and verify they are added. Then logout and close the browser"
  );

  const reportUrl = "http://localhost:4000/report/index.html";

  const [grep, setGrep] = useState("login");
  const [selectedFile, setSelectedFile] = useState("");
  const [selected, setSelected] = useState("");
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
  const [loading, setLoading] = useState(false);

  const [options, setOptions] = useState<string[]>([]);
    useEffect(() => {
    fetch("http://localhost:4000/api/tests")
      .then(res => res.json())
      .then(data => {
        if (data.ok) setOptions(data.files);
      })
      .catch(err => console.error("Failed to fetch test files:", err));
  }, []);

  async function onGenerate() {
     setLoading(true); // show spinner
    console.log(loading);
    const j = await call("/api/self-heal", { prompt});//, filename, baseURL });
    // setLog((prev) => prev + "\nGenerated: " + JSON.stringify(j, null, 2));
   setOptions((prevOptions) =>
      prevOptions.includes(j.result.filename) ? prevOptions : [...prevOptions, j.result.filename]
    );
    setTimeout(() => {
      console.log(loading);
      setLog((prev) => prev + "\nRun: " + JSON.stringify(j, null, 2));
      setLoading(false); // hide spinner once log is updated
    }, 1000);
  }

  async function onRun() {
    setLoading(true); // show spinner
    console.log("selected file,", selectedFile);
    const j = await call("/api/run", { selectedFile, grep, baseURL });
    // setLog((prev) => prev + "\nRun: " + JSON.stringify(j, null, 2));
    
    setTimeout(() => {
      setLog((prev) => prev + "\nRun: " + JSON.stringify(j, null, 2));
      setLoading(false); // hide spinner once log is updated
    }, 1000);
  }
 

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-10 px-4">
  <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8 space-y-8">
    {/* Title */}
   <div className="text-4xl font-extrabold text-white text-center bg-blue-600 py-8 px-4 rounded-lg shadow-md">
        <h1>Test Automation Demo</h1>
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
    <a
        href={reportUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md transition"
      >
        Open Report
      </a>
      
    </div>

    {/* Test Runner Section */}
    <div className="bg-gray-100 rounded-xl p-6 space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">Test Runner</h2>
     <TestFileDropdown
        options={options}
        selected={selected}
        onSelect={setSelected}
      />
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
<div >
 <Spinner
  overlay
  show={loading}
  label="Running script please wait..."
/>
</div>
   
    
  </div>
</div>
    </>
  );
} 