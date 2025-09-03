import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';

import { experimental_createMCPClient } from 'ai';
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { writeFile, mkdir } from "fs/promises";
import path from "node:path"; 
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { spawn } from "child_process";
import os from "node:os";
import { exec } from "child_process";
import fs from "fs";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
 
// Create an MCP client connected to the mcp-server via stdio
async function getMcpTools() {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ['@playwright/mcp@latest'],
    cwd: process.cwd(),  
    env: process.env as Record<string, string>
  });

  const client = await experimental_createMCPClient({ transport });
  const tools = await client.tools();
  // console.log("Available tools:", tools);
  return { client, tools };
}
 
// System prompt that forces clean Playwright Test output
const SYSTEM = `You are a senior test engineer. Generate Playwright Test (TypeScript) code only.
Rules:
- Use @playwright/test syntax (test(), expect()).
- Parameterize credentials via process.env (e.g. USERNAME/PASSWORD).
- No explanations, just the code.
- Place everything in one .spec.js file.
- ignore case sensitivity while comparing text
- if multiple elements are present, write unique selectors
- wait for elements to be visible before interacting
- handle navigation and page loads properly
- handle iframes if present
- All browser interactions must be executed using the Playwright MCP server tools.
- Do not generate raw Playwright code or JavaScript — always call the Playwright MCP tool.
`;

const GenSchema = z.object({
  prompt: z.string(),
  filename: z.string().default('generated-login.spec.ts'),
  baseURL: z.string().url().optional()
});

// 1) Generate a test file from a natural-language prompt
app.post('/api/generate', async (req, res) => {
  const { prompt, filename, baseURL } = GenSchema.parse(req.body);
  try {
  
    const { client, tools } = await getMcpTools();
    console.log("Found tools for generation:", JSON.stringify(tools));
    
const response = await generateText({
   model: openai("gpt-4o-mini"),//model: openai("gpt-4o-mini"),
  system: SYSTEM,
  prompt,
  tools,
});
let text = response.text;

 text = text.replace('```typescript','');
text = text.replace('```','');
text = text.replace('process.env.USERNAME ||','');
text = text.replace('process.env.PASSWORD ||','');
//  console.log("Generated test:\n", text);
  // ensure tests folder exists and write the file
    const testsDir = path.resolve(process.cwd(), "tests");
    await mkdir(testsDir, { recursive: true });
    const outPath = path.join(testsDir, filename.endsWith(".spec.js") ? filename : `${filename}.spec.js`);
    await writeFile(outPath, text, "utf8");

    return res.json({ ok: true, savedAt: outPath });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});
 
// 2) Run tests
app.post("/api/run", async (req, res) => {
  try {
    const { selectedFile, grep } = req.body;

    if (!selectedFile) {
      return res.status(400).json({ ok: false, error: 'Missing specFile' });
    }
    // console.log(`Running Playwright test: ${selectedFile} grep=${grep}`);
    const result = await runPlaywright(selectedFile, grep);

    res.json({
      ok: true,
      report: result, // full JSON report
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

async function runPlaywright(specFile?: string, grep?: string) {
  return new Promise((resolve, reject) => {
    const reportDir = path.resolve(process.cwd(), "playwright-report");
    
    const cmd = `npx playwright test tests/${specFile} --reporter=allure-playwright --output=${reportDir} --workers=1 --headed`;
    // console.log("Executing command:", cmd);
    exec(cmd, { env: { ...process.env, FORCE_COLOR: "0" }, timeout:60000 }, (err, stdout, stderr) => {
      // console.log("Playwright test run completed.",{ ok: true, stdout, stderr, reportPath: reportDir });
      if (err) {
        return reject({ ok: false, stdout, stderr, reportPath: reportDir, error: err.message });
      }
      resolve({ ok: true, stdout, stderr, reportPath: reportDir });
    });
      
    const resultsDir = path.resolve(process.cwd(), "allure-results");
    const allReportDir = path.resolve(process.cwd(), "allure-report");
    const allureCmd = `npx allure generate ${resultsDir} --clean -o ${allReportDir}`;
      exec(
        allureCmd,
        { env: { ...process.env, FORCE_COLOR: "0" } },
        (allureErr, allureStdout, allureStderr) => {
          
        }
      );
   });
}

app.get("/api/tests", (req, res) => {
  const testDir = path.resolve(process.cwd(), "tests"); // adjust path if needed

  try {
    const files = fs.readdirSync(testDir).filter(f => f.endsWith(".spec.ts") || f.endsWith(".spec.js"));
    res.json({ ok: true, files });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

app.get("/api/cwd", (req, res) => {
  res.json({ cwd: process.cwd() });
});

// Absolute path to the Playwright report folder
const reportDir = path.resolve(process.cwd(), "allure-report");

// Serve it as static files under /report
app.use("/report", express.static(reportDir));

app.listen(4000, () => console.log('Orchestrator listening on http://localhost:4000'));
