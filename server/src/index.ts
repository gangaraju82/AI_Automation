import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';

import { experimental_createMCPClient, generateText, generateObject } from 'ai';
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { writeFile, mkdir } from "fs/promises";
import path from "node:path"; 
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { exec } from "child_process";
import fs from "fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

// ----------------- EXPRESS APP -----------------
const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// ----------------- UNIFIED SYSTEM PROMPT -----------------
const BASE_SYSTEM_RULES = `You are a senior test engineer. Generate Playwright Test (TypeScript) code only.
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


const REPAIR_INSTRUCTIONS = `
You are repairing a failing Playwright test. Apply the same rules above plus:
- Fix "strict mode violation" by making locators unique (role+name, nth(), parent chaining).
- Fix timeouts by waiting for navigation, network idle, or element visible/enabled.
- If navigation happens, use: await Promise.all([ page.waitForNavigation(), action() ]);
- If UI triggers XHR/fetch updates, wait on expect(locator).toHaveText/Count/Value instead of waitForTimeout.
- Keep the same test name unless the flow truly changed.
Return ONLY the corrected .spec.ts code.
`;

// ----------------- LLM SETUP -----------------
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const gemini = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! });
const useOpenAI = true;

// ----------------- MCP CLIENT -----------------
async function getMcpTools() {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ['@playwright/mcp@latest'],
    cwd: process.cwd(),  
    env: process.env as Record<string, string>
  });

  const client = await experimental_createMCPClient({ transport });
  const tools = await client.tools();
  return { client, tools };
}

// ----------------- GENERATE TEST API -----------------
const GenSchema = z.object({
  prompt: z.string(),
  filename: z.string().default('generated-login.spec.ts'),
});

app.post('/api/generate', async (req, res) => {
  const { prompt, filename } = GenSchema.parse(req.body);
  try {
    const { tools } = await getMcpTools();

    const response = await generateText({
      model: openai("gpt-4.1"),
      system: BASE_SYSTEM_RULES,
      prompt,
      tools,
    });

    let text = response.text
      .replace('```typescript','')
      .replace('```','')
      .replace('process.env.USERNAME ||','')
      .replace('process.env.PASSWORD ||','');

    const testsDir = path.resolve(process.cwd(), "tests");
    await mkdir(testsDir, { recursive: true });
    const outPath = path.join(testsDir, filename.endsWith(".spec.ts") ? filename : `${filename}.spec.ts`);
    await writeFile(outPath, text, "utf8");

    return res.json({ ok: true, savedAt: outPath });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

// ----------------- RUN TEST API -----------------
app.post("/api/run", async (req, res) => {
  try {
    const { selectedFile, grep } = req.body;
    if (!selectedFile) {
      return res.status(400).json({ ok: false, error: 'Missing specFile' });
    }
    const result = await runPlaywright(selectedFile, grep);
    res.json({ ok: true, report: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

async function runPlaywright(specFile?: string, grep?: string) {
  return new Promise((resolve) => {
    const reportDir = path.resolve(process.cwd(), "playwright-report");
    const cmd = `npx playwright test tests/${specFile} --reporter=allure-playwright --output=${reportDir} --workers=1 --headed ${grep ? `--grep "${grep}"` : ""}`;
    exec(cmd, { env: { ...process.env, FORCE_COLOR: "0" }, timeout:60000 }, (err, stdout, stderr) => {
      if (err) {
        return resolve({ ok: false, stdout, stderr, reportPath: reportDir, error: err.message });
      }
      resolve({ ok: true, stdout, stderr, reportPath: reportDir });
    });

    const resultsDir = path.resolve(process.cwd(), "allure-results");
    const allReportDir = path.resolve(process.cwd(), "allure-report");
    exec(`npx allure generate ${resultsDir} --clean -o ${allReportDir}`, { env: { ...process.env, FORCE_COLOR: "0" } });
  });
}

// ----------------- TESTS LIST API -----------------
app.get("/api/tests", (req, res) => {
  const testDir = path.resolve(process.cwd(), "tests");
  try {
    const files = fs.readdirSync(testDir).filter(f => f.endsWith(".spec.ts") || f.endsWith(".spec.js"));
    res.json({ ok: true, files });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// ----------------- CWD API -----------------
app.get("/api/cwd", (req, res) => {
  res.json({ cwd: process.cwd() });
});

// ----------------- SERVE REPORT -----------------
const reportDir = path.resolve(process.cwd(), "allure-report");
app.use("/report", express.static(reportDir));

/* =======================================================
   =============== SELF-HEALING INTEGRATION ===============
   ======================================================= */

const TestSpec = z.object({
  filename: z.string().min(1),
  code: z.string().min(1),
});
type TestSpec = z.infer<typeof TestSpec>;

async function llmGenerateTest(prompt: string): Promise<TestSpec> {
  const model = useOpenAI ? openai("gpt-4o-mini") : gemini("gemini-2.0-flash-exp");

  const { object } = await generateObject({
    model,
    system: BASE_SYSTEM_RULES,
    prompt: `
You are to generate a Playwright Test based on this description.

DESCRIPTION:
${prompt}

Return strictly in JSON that matches this schema:
{
  "filename": "some-test.spec.ts",
  "code": "<entire Playwright .spec.ts file>"
}

Do NOT include markdown, code fences, or explanations.
    `,
    schema: TestSpec,
  });

  if (!object) {
    throw new Error("Model did not return JSON matching TestSpec.");
  }

  console.log("✅ LLM generated test:", object.filename);
  return object;
}

import { promisify } from "util";
const execAsync = promisify(exec);
async function llmRepairTest(currentCode: string, failureLog: string): Promise<string> {
  const model = useOpenAI ? openai("gpt-4o-mini") : gemini("gemini-2.0-flash-exp");

  const FixedCode = z.object({ code: z.string().min(1) });

  const { object } = await generateObject({
    model,
    system: BASE_SYSTEM_RULES + "\n" + REPAIR_INSTRUCTIONS,
    prompt: `
Repair the following failing Playwright test.

CURRENT TEST CODE:
${currentCode}

FAILURE LOG:
${failureLog}

Return strictly in JSON:
{
  "code": "<fixed .spec.ts code>"
}

Do NOT include markdown, code fences, or explanations.
    `,
    schema: FixedCode,
  });

  if (!object) {
    throw new Error("Model did not return repaired code.");
  }

  return object.code;
}

async function connectMcp() {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["@playwright/mcp@latest"],
    cwd: process.cwd(),
    env: process.env as Record<string, string>,
  });
  const client = new Client({ name: "orchestrator", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

function firstText(result: any): string {
  const content = result?.content ?? result;
  if (Array.isArray(content)) {
    const t = content.find((c) => c?.type === "text");
    return t?.text ?? JSON.stringify(result);
  }
  if (typeof content === "string") return content;
  return JSON.stringify(result);
}

function summarizeFailure(run: any): string {
  const raw = [run.err, run.out].filter(Boolean).join("\n");
  const lines = raw.split(/\r?\n/);
  const interesting = lines.filter((l) =>
    /(Error|Timeout|strict mode|failed|not.*visible|detached|multiple elements|No node found)/i.test(l)
  );
  return interesting.slice(0, 120).join("\n") || raw.slice(0, 5000);
}

async function selfHeal({
  prompt,
  maxRounds = 4,
  grep,
}: {
  prompt: string;
  maxRounds?: number;
  grep?: string;
}) {
  const client = await connectMcp();
  console.log("Connected to MCP");

  try {
    // 1) Generate initial test
    const initial = await llmGenerateTest(prompt);
    console.log("Initial test generated:", initial.filename);
    let currentFilename = initial.filename;
    let currentCode = initial.code;
      // .replace('process.env.USERNAME','')
      // .replace('process.env.PASSWORD','')
      // .replace('process.env.USERNAME ||','')
      // .replace('process.env.PASSWORD ||','');

    const testsDir = path.resolve(process.cwd(), "tests");
    await mkdir(testsDir, { recursive: true });
    const testPath = path.join(testsDir, currentFilename);
    await writeFile(testPath, currentCode, "utf8");

   

    // 2) Run/repair loop
    for (let round = 1; round <= maxRounds; round++) {
      console.log(`\n=== ROUND ${round}/${maxRounds} ===`);

      const reportDir = path.resolve(process.cwd(), "playwright-report");
      const cmd = `npx playwright test tests/${initial.filename} --reporter=allure-playwright --output=${reportDir} --workers=1 --headed ${
        grep ? `--grep "${grep}"` : ""
      }`;

      let parsed: any;
      try {
        const { stdout, stderr } = await execAsync(cmd, {
          env: { ...process.env, FORCE_COLOR: "0" },
          timeout: 60_000,
        });

        parsed = { exitCode: 0, out: stdout, err: stderr, RESULTS_DIR: reportDir };
      } catch (err: any) {
        parsed = {
          exitCode: err.code ?? 1,
          out: err.stdout ?? "",
          err: err.stderr ?? err.message,
        };
      }

      console.log("Exit code:", parsed.exitCode);

      if (parsed.exitCode === 0) {
        console.log("✅ Test passed!");
        try {
          // optional allure build
          await client.callTool({ name: "build_allure", arguments: {} });
        } catch {
          console.warn("⚠️ Allure build failed (non-fatal)");
        }
        return { status: "passed", filename: currentFilename };
      }

      // 3) Summarize failure and repair
      const failure = summarizeFailure(parsed);
      console.log("Failure summary:\n", failure);

      let fixedCode = await llmRepairTest(currentCode, failure);
      // fixedCode = fixedCode
      // .replace('process.env.USERNAME','')
      // .replace('process.env.PASSWORD','')
      // .replace('process.env.USERNAME ||','')
      // .replace('process.env.PASSWORD ||','');
      await writeFile(testPath, fixedCode, "utf8");

      currentCode = fixedCode;
    }

    console.log("❌ Max rounds reached without passing");
    return { status: "failed", filename: currentFilename };
  } finally {
     const resultsDir = path.resolve(process.cwd(), "allure-results");
    const allReportDir = path.resolve(process.cwd(), "allure-report");
    exec(`npx allure generate ${resultsDir} --clean -o ${allReportDir}`, { env: { ...process.env, FORCE_COLOR: "0" } });

    if (typeof (client as any).close === "function") {
      await (client as any).close();
    }
  }
}

// ----------------- SELF-HEAL API -----------------
const SelfHealSchema = z.object({
  prompt: z.string().min(1),
  maxRounds: z.number().optional(),
  grep: z.string().optional(),
});

app.post("/api/self-heal", async (req, res) => {
  try {
    const { prompt, maxRounds, grep } = SelfHealSchema.parse(req.body);
    const result = await selfHeal({ prompt, maxRounds, grep });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ----------------- START SERVER -----------------
app.listen(4000, () => console.log('✅ Orchestrator listening on http://localhost:4000'));
