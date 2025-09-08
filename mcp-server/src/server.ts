import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { mkdir, writeFile } from "fs/promises";
import { spawn } from "node:child_process";
import * as path from "node:path";

const ROOT = process.env.PW_ROOT || path.resolve(process.cwd(), "..", "pw-project");
const TEST_DIR = path.join(ROOT, "tests");
const RESULTS_DIR = path.join(ROOT, "allure-results");
const REPORT_DIR = path.join(ROOT, "allure-report");

const server = new McpServer({ name: "playwright-tools", version: "0.1.0" });
const asAny = (v: unknown) => v as unknown as any;
// Define schemas (we create both "raw shape" and "z.object" forms so you can use either at runtime)
const writeTestShape = {
  filename: z.string(),
  code: z.string(),
};

const runPlaywrightShape = {
  grep: z.string().optional(),
};

const buildAllureShape = {}; // empty input
/**
 * 1) write_test: save code to tests/<filename>.spec.ts
 */
server.registerTool(
  "write_test",
  {
    title: "Write a Playwright test",
    description: "Create/overwrite a Playwright Test spec file under tests/",
    inputSchema: asAny(z.object(writeTestShape)),
  },
  async ({ filename, code }, extra) => {
    await mkdir(TEST_DIR, { recursive: true });
    const safeName = filename.endsWith(".spec.ts") ? filename : `${filename}.spec.ts`;
    const fullPath = path.join(TEST_DIR, safeName);
    await writeFile(fullPath, code, "utf8");

    return { content: [{ type: "text", text: `✅ Test written to ${fullPath}` }] };
  }
);

/**
 * 2) run_playwright: execute tests and return summary logs
 */
server.registerTool(
  "run_playwright",
  {
    title: "Run Playwright (with Allure)",
    description: "Executes Playwright tests; results go to allure-results/",
    inputSchema: asAny(z.object(runPlaywrightShape)),
  },
  async ({ grep }, extra) => {
    const args = ["playwright", "test"];
    if (grep) args.push("--grep", grep);

    const proc = spawn("npx", args, { cwd: ROOT, shell: true });

    let out = "",
      err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));

    const exitCode: number = await new Promise((res) => proc.on("close", res));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ exitCode, out, err, RESULTS_DIR }, null, 2),
        },
      ],
    };
  }
);

/**
 * 3) build_allure: generate HTML report from allure-results
 */
server.registerTool(
  "build_allure",
  {
    title: "Build Allure HTML",
    description: "Generates ./allure-report from ./allure-results",
    inputSchema: asAny(z.object(buildAllureShape)),
  },
  async ({}, extra) => {
    const proc = spawn("npx", ["allure", "generate", "./allure-results", "--clean"], {
      cwd: ROOT,
      shell: true,
    });

    let out = "",
      err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));

    const exitCode: number = await new Promise((res) => proc.on("close", res));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ exitCode, REPORT_DIR, out, err }, null, 2),
        },
      ],
    };
  }
);

// Start server
const transport = new StdioServerTransport();
console.log("🚀 Playwright MCP server starting...");
(async () => {
  await server.connect(transport);
})();
