#!/usr/bin/env node
import { Command } from "commander";

import { startDashboard } from "./server.js";

const program = new Command()
  .name("codex-spec-dashboard")
  .description("Real-time structured workflow dashboard")
  .option("-p, --project <path...>", "Project paths", [process.cwd()])
  .option("--host <host>", "Listen host", "127.0.0.1")
  .option("--port <number>", "Listen port", "8247")
  .option(
    "--read-only",
    "Reject non-read HTTP methods (recommended for tunnels)",
    false,
  )
  .action(
    async (options: {
      project: string[];
      host: string;
      port: string;
      readOnly: boolean;
    }) => {
      const dashboard = await startDashboard({
        projects: options.project,
        host: options.host,
        port: Number(options.port),
        readOnly: options.readOnly,
      });
      process.stdout.write(`Codex Spec Workflow dashboard: ${dashboard.url}\n`);
    },
  );

await program.parseAsync();
