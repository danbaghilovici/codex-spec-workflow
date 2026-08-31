import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { completeTask, loadTasks } from "../src/tasks.js";
import { setApproval, transitionWorkflow } from "../src/transitions.js";
import {
  initializeWorkflow,
  readWorkflow,
  writeWorkflow,
} from "../src/workflow-store.js";

describe("golden workflow lifecycles", () => {
  it("completes a full spec lifecycle from gates through task evidence", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-spec-life-"));
    let workflow = await initializeWorkflow({
      projectRoot: root,
      kind: "spec",
      name: "feature",
      title: "Feature",
    });
    workflow = setApproval(workflow, "requirements", true);
    workflow = transitionWorkflow(workflow, "design");
    workflow = setApproval(workflow, "design", true);
    workflow = transitionWorkflow(workflow, "tasks");
    workflow = setApproval(workflow, "tasks", true);
    workflow = transitionWorkflow(workflow, "implementation");
    await writeWorkflow(root, workflow);

    const directory = path.join(root, ".codex-specs", "specs", "feature");
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "tasks.md"),
      "- [ ] 1 First\n  - _Depends on: none_\n- [ ] 2 Second\n  - _Depends on: 1_\n",
    );
    await completeTask(root, "feature", "1");
    await completeTask(root, "feature", "2");
    const tasks = await loadTasks(root, "feature");
    workflow = transitionWorkflow(
      await readWorkflow(root, "spec", "feature"),
      "complete",
      {
        tasksComplete: tasks.every((task) => task.completed),
      },
    );
    expect(workflow.phase).toBe("complete");
  });
});
