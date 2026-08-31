import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  completeTask,
  normalizeTaskMarkdown,
  parseTasks,
  selectNextTask,
  validateTasks,
} from "../src/tasks.js";

const markdown = `# Tasks

- [x] 1. Build the base
  - Files: src/base.ts
  - _Requirements: 1.1_
  - _Depends on: none_

- [ ] 2.1. Add the feature
  - Files: src/feature.ts
  - _Leverage: src/base.ts_
  - _Requirements: 2.1, 2.2_
  - _Dependencies: 1_

- [ ] 3 Verify integration
  - _Depends on: 2.1_
`;

describe("task parsing and selection", () => {
  it("parses supported formats and metadata", () => {
    const tasks = parseTasks(markdown);
    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toMatchObject({
      id: "1",
      completed: true,
      requirements: "1.1",
    });
    expect(tasks[1]).toMatchObject({
      id: "2.1",
      leverage: "src/base.ts",
      requirements: "2.1, 2.2",
      dependencies: ["1"],
    });
    expect(selectNextTask(tasks).task?.id).toBe("2.1");
  });

  it("rejects missing dependencies and cycles", () => {
    expect(() =>
      validateTasks(
        parseTasks(
          "- [ ] 1 First\n  - _Depends on: 2_\n- [ ] 2 Second\n  - _Depends on: 1_",
        ),
      ),
    ).toThrow(/cycle/i);
    expect(() =>
      validateTasks(parseTasks("- [ ] 1 First\n  - _Depends on: 9_")),
    ).toThrow(/missing dependency 9/i);
  });

  it("normalizes legacy empty checkboxes", () => {
    expect(normalizeTaskMarkdown("- [] 1 Task")).toBe("- [ ] 1 Task");
  });

  it("atomically completes a ready task and creates a backup", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-spec-tasks-"));
    const directory = path.join(root, ".codex-specs", "specs", "sample");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "tasks.md"), markdown);
    await completeTask(root, "sample", "2.1");
    expect(await readFile(path.join(directory, "tasks.md"), "utf8")).toContain(
      "- [x] 2.1. Add",
    );
    await expect(completeTask(root, "sample", "3")).resolves.toMatchObject({
      completed: true,
    });
  });
});
