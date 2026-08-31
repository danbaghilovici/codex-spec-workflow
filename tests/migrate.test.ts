import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { migrateFromClaude } from "../src/migrate.js";
import { readWorkflow } from "../src/workflow-store.js";

describe("Claude workflow migration", () => {
  it("copies content, normalizes tasks, and converts approval markers without touching source", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-spec-migrate-"));
    const source = path.join(root, ".claude", "specs", "sample");
    await mkdir(source, { recursive: true });
    await writeFile(
      path.join(source, "requirements.md"),
      "# Requirements\n\n✅ APPROVED\n",
    );
    await writeFile(
      path.join(source, "design.md"),
      "# Design\n\n✅ APPROVED\n",
    );
    await writeFile(
      path.join(source, "tasks.md"),
      "# Tasks\n\n✅ APPROVED\n\n- [] 1 Work\n",
    );

    const report = await migrateFromClaude({ projectRoot: root });
    expect(report.warnings).toEqual([]);
    expect(await readFile(path.join(source, "tasks.md"), "utf8")).toContain(
      "- [] 1 Work",
    );
    expect(
      await readFile(
        path.join(root, ".codex-specs", "specs", "sample", "tasks.md"),
        "utf8",
      ),
    ).toContain("- [ ] 1 Work");
    expect((await readWorkflow(root, "spec", "sample")).phase).toBe(
      "implementation",
    );
  });

  it("reports ambiguous later documents and dry-run leaves targets absent", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-spec-migrate-dry-"));
    const source = path.join(root, ".claude", "specs", "ambiguous");
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, "requirements.md"), "# Requirements\n");
    await writeFile(path.join(source, "design.md"), "# Design\n");
    const report = await migrateFromClaude({ projectRoot: root, dryRun: true });
    expect(report.warnings.join("\n")).toMatch(/no approval marker/i);
    await expect(
      readFile(
        path.join(root, ".codex-specs", "specs", "ambiguous", "workflow.json"),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});
