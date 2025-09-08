import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { mkdir, writeFile } from "fs/promises";
import { spawn } from "node:child_process";
import * as path from "node:path";

// Root paths
const ROOT = process.env.PW_ROOT || path.resolve(process.cwd(), "pw-project");
const TEST_DIR = path.join(ROOT, "tests");
const RESULTS_DIR = path.join(ROOT, "allure-results");
const REPORT_DIR = path.join(ROOT, "allure-report");

// Create server
const server = new McpServer({ name: "playwright-tools", version: "0.1.0" });
/**
 * 1) write_test
 */
server.registerTool(
  "write_test",
  {
    title: "Write a Playwright test",
    description: "Create/overwrite a Playwright Test spec file under tests/",
    inputSchema: z.object({
      filename: z.string(),
      code: z.string(),
    }),
  },
  async ({ filename, code }) => {
    await mkdir(TEST_DIR, { recursive: true });
    const safeName = filename.endsWith(".spec.ts")
      ? filename
      : `${filename}.spec.ts`;
    const fullPath = path.join(TEST_DIR, safeName);

    console.log("📝 Writing test to", fullPath);
    await writeFile(fullPath, code, "utf8");

    return { content: [{ type: "text", text: `✅ Test written: ${fullPath}` }] };
  }
);

/**
 * 2) run_playwright
 */
server.registerTool(
  "run_playwright",
  {
    title: "Run Playwright (with Allure)",
    description: "Executes Playwright tests; results go to allure-results/",
    inputSchema: z.object({
      grep: z.string().optional(),
    }),
  },
  async ({ grep }) => {
    const args = ["playwright", "test"];
    if (grep) args.push("--grep", grep);

    const proc = spawn("npx", args, { cwd: ROOT, shell: true });

    let out = "",
      err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));

    const exitCode = await new Promise((res) => proc.on("close", res));

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
 * 3) build_allure
 */
server.registerTool(
  "build_allure",
  {
    title: "Build Allure HTML",
    description: "Generates ./allure-report from ./allure-results",
    inputSchema: z.object({}), // must be a zod object
  },
  async () => {
    const proc = spawn(
      "npx",
      ["allure", "generate", "./allure-results", "--clean"],
      {
        cwd: ROOT,
        shell: true,
      }
    );

    let out = "",
      err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));

    const exitCode = await new Promise((res) => proc.on("close", res));

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
  console.log(
    "✅ MCP server running with tools: write_test, run_playwright, build_allure"
  );
})();
