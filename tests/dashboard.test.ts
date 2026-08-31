import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildDashboardServer,
  isMutationMethod,
} from "../src/dashboard/server.js";
import type { DashboardSnapshot } from "../src/dashboard/snapshot.js";
import { initializeWorkflow } from "../src/workflow-store.js";

describe("dashboard contracts", () => {
  it("serves the same structured state as workflow.json", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-spec-dashboard-"));
    await initializeWorkflow({
      projectRoot: root,
      kind: "spec",
      name: "sample",
      title: "Sample",
    });
    const spec = path.join(root, ".codex-specs", "specs", "sample");
    await mkdir(spec, { recursive: true });
    await writeFile(
      path.join(spec, "tasks.md"),
      "- [x] 1 Done\n- [ ] 2 Pending\n",
    );

    const dashboard = await buildDashboardServer({
      projects: [root],
      readOnly: true,
    });
    const response = await dashboard.server.inject({
      method: "GET",
      url: "/api/snapshot",
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as unknown as DashboardSnapshot;
    expect(body.projects[0].specs[0].workflow.phase).toBe("requirements");
    expect(body.projects[0].specs[0].progress).toMatchObject({
      completed: 1,
      total: 2,
      percent: 50,
    });
    const blocked = await dashboard.server.inject({
      method: "POST",
      url: "/api/snapshot",
    });
    expect(blocked.statusCode).toBe(405);
    await dashboard.closeWatcher();
    await dashboard.server.close();
  });

  it("classifies mutation methods for tunnel protection", () => {
    expect(isMutationMethod("GET")).toBe(false);
    expect(isMutationMethod("HEAD")).toBe(false);
    expect(isMutationMethod("POST")).toBe(true);
    expect(isMutationMethod("DELETE")).toBe(true);
  });
});
