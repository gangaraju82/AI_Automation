import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from "zod";

import { generateObject } from 'ai';
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import path from "node:path"; 
import { createOpenAI } from '@ai-sdk/openai';
import fs from "fs";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// -------------------- Express setup --------------------
const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// -------------------- MCP Client --------------------
async function getMcpTools() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["../mcp-server/src/server.js"], // your MCP server entrypoint
    cwd: process.cwd(),
    env: process.env as Record<string, string>
  });

  const client = new Client({ name: "mcp-client", version: "1.0.0" });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log("✅ Available tools:", tools);
  return client;
}

// -------------------- LLM Setup --------------------
const SYSTEM_RULES = `
You are a senior Playwright Test engineer. Always produce TypeScript tests that follow these rules:
- Use Playwright Test (@playwright/test) with 'test' and 'expect'.
- ALWAYS await actions: goto/click/fill/check/hover/press.
- Prefer robust locators: getByRole/getByLabel/getByPlaceholder/getByText; avoid brittle CSS unless necessary.
- Before interacting, ensure visibility: await expect(locator).toBeVisible().
- When multiple matches exist, refine the locator with role, name, nth(), or a container locator.
- Use test.step() to group logical actions.
- Never use page.waitForTimeout() except as a last resort; prefer await expect(...) or locator.waitFor().
- Return ONLY valid .spec.ts code. No comments or explanations outside the code.
`;

const REPAIR_INSTRUCTIONS = `
You are repairing a failing Playwright test. Apply the same rules as above plus:
- Fix "strict mode violation" by making locators unique (role+name, nth(), parent chaining).
- Fix timeouts by waiting for navigation, network idle, or element visible/enabled as appropriate.
- If navigation happens, use: await Promise.all([ page.waitForNavigation(), action()]);
- If UI triggers XHR/fetch updates, wait on expect(locator).toHaveText/Count/Value/... instead of waitForTimeout.
- Keep the same test name unless the flow truly changed.
Return ONLY the corrected .spec.ts code.
`;

const useOpenAI = true;

const openAI = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});
const gemini = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

// -------------------- Zod Schemas --------------------
const GenSchema = z.object({
  prompt: z.string(),
  filename: z.string().default('generated-login.spec.ts'),
  baseURL: z.string().url().optional()
});

const TestSpec = z.object({
  filename: z.string().min(1).describe("The spec filename, e.g., login.spec.ts"),
  code: z.string().min(1).describe("The complete .spec.ts file content"),
});
type TestSpec = z.infer<typeof TestSpec>;

// -------------------- LLM Helpers --------------------
async function llmGenerateTest(prompt: string): Promise<TestSpec> {
  const model = useOpenAI ? openAI("gpt-4o-mini") : gemini("gemini-2.0-flash-exp");
  const { object } = await generateObject({
    model,
    system: SYSTEM_RULES,
    prompt,
    schema: TestSpec,
  });
  return object;
}

async function llmRepairTest(currentCode: string, failureLog: string): Promise<string> {
  const model = useOpenAI ? openAI("gpt-4o-mini") : gemini("gemini-2.0-flash-exp");
  const FixedCode = z.object({ code: z.string().min(1) });

  const { object } = await generateObject({
    model,
    system: SYSTEM_RULES + "\n" + REPAIR_INSTRUCTIONS,
    prompt: `The following Playwright test failed. Repair it.\n\nCURRENT TEST CODE:\n\`\`\`ts\n${currentCode}\n\`\`\`\n\nFAILURE LOG (verbatim):\n\`\`\`\n${failureLog}\n\`\`\`\n\nReturn JSON: {"code": "<fixed .spec.ts>"} — code only, no commentary.`,
    schema: FixedCode,
  });

  return object.code;
}

// -------------------- MCP Tool Wrappers --------------------
async function tool_writeTest(client: Client, filename: string, code: string) {
  const response = await client.callTool({
    name: "write_test",
    arguments: { filename, code }, // ✅ matches server schema
  });
  console.log("Tool response:", response);
  return response;
}

type RunResult = {
  exitCode: number;
  out: string;
  err: string;
  RESULTS_DIR?: string;
};

async function tool_runPlaywright(client: Client, grep?: string): Promise<RunResult> {
  const res = await client.callTool({
    name: "run_playwright",
    arguments: grep ? { grep } : {}, // ✅ matches server schema
  });
  const text = firstText(res);
  try {
    return JSON.parse(text) as RunResult;
  } catch {
    return { exitCode: 1, out: text, err: "" };
  }
}

async function tool_buildAllure(client: Client) {
  const res = await client.callTool({ name: "build_allure", inputSchema: z.object({}), }); // ✅ schema requires {}
  return firstText(res);
}

// -------------------- Utility --------------------
function firstText(result: any): string {
  const content = result?.content ?? result;
  if (Array.isArray(content)) {
    const t = content.find((c) => c?.type === "text");
    return t?.text ?? JSON.stringify(result);
  }
  if (typeof content === "string") return content;
  return JSON.stringify(result);
}

function summarizeFailure(run: RunResult): string {
  const raw = [run.err, run.out].filter(Boolean).join("\n");
  const lines = raw.split(/\r?\n/);
  const interesting = lines.filter((l) =>
    /(Error|Timeout|strict mode|failed|not.*visible|detached|multiple elements|No node found)/i.test(l)
  );
  return interesting.slice(0, 120).join("\n") || raw.slice(0, 5000);
}

// -------------------- Express Routes --------------------

// 1) Generate + repair loop
app.post('/api/generate', async (req, res) => {
  const { prompt, filename } = GenSchema.parse(req.body);
  const client = await getMcpTools();

  try {
    const initial = await llmGenerateTest(prompt);
    console.log(`Generated file: ${initial.filename}`);
    await tool_writeTest(client, initial.filename, initial.code);

    let currentFilename = initial.filename;
    let currentCode = initial.code;
    const maxRounds = 4;

    for (let round = 1; round <= maxRounds; round++) {
      console.log(`\n=== RUN ${round}/${maxRounds} ===`);
      const result = await tool_runPlaywright(client);
      console.log(`Exit code: ${result.exitCode}`);

      if (result.exitCode === 0) {
        console.log("✅ Tests passed!");
        try {
          const allure = await tool_buildAllure(client);
          console.log("Allure:", allure);
        } catch (e) {
          console.warn("Allure build failed:", e);
        }
        return res.json({ status: "passed", filename: currentFilename });
      }

      const failure = summarizeFailure(result);
      console.log("\n--- Failure summary ---\n", failure);

      const fixedCode = await llmRepairTest(currentCode, failure);
      await tool_writeTest(client, currentFilename, fixedCode);
      currentCode = fixedCode;
    }

    console.log("❌ Reached max rounds without green.");
    return res.json({ status: "failed", filename: currentFilename });
  } finally {
    if (typeof (client as any).close === "function") {
      await (client as any).close();
    }
  }
});

// 2) List tests
app.get("/api/tests", (req, res) => {
  const testDir = path.resolve(process.cwd(), "tests");
  try {
    const files = fs.readdirSync(testDir).filter(f => f.endsWith(".spec.ts") || f.endsWith(".spec.js"));
    res.json({ ok: true, files });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// 3) Serve Allure report
const reportDir = path.resolve(process.cwd(), "allure-report");
app.use("/report", express.static(reportDir));

// -------------------- Start Orchestrator --------------------
app.listen(4000, () => console.log('🚀 Orchestrator listening on http://localhost:4000'));
