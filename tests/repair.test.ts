import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { repairWorkflows } from "../src/repair.js";
import { readWorkflow } from "../src/workflow-store.js";

describe("state repair", () => {
  it("creates conservative state and reports ambiguous documents", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-spec-repair-"));
    const directory = path.join(root, ".codex-specs", "specs", "sample");
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "requirements.md"),
      "# Requirements\n",
    );
    await writeFile(path.join(directory, "design.md"), "# Design\n");
    const result = await repairWorkflows(root);
    expect(result[0]).toMatchObject({ action: "created" });
    expect(result[0]?.warnings.join("\n")).toMatch(
      /no recognizable approval marker/i,
    );
    expect((await readWorkflow(root, "spec", "sample")).phase).toBe(
      "requirements",
    );
  });
});
