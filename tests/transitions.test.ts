import { describe, expect, it } from "vitest";

import { WorkflowSchema } from "../src/schemas.js";
import {
  createBugWorkflow,
  createSpecWorkflow,
  setApproval,
  transitionWorkflow,
} from "../src/transitions.js";

describe("workflow transitions", () => {
  it("enforces each spec approval gate and completion evidence", () => {
    let workflow = createSpecWorkflow(
      "feature",
      "Feature",
      undefined,
      new Date("2026-01-01T00:00:00Z"),
    );
    expect(() => transitionWorkflow(workflow, "design")).toThrow(/approval/i);
    workflow = setApproval(
      workflow,
      "requirements",
      true,
      new Date("2026-01-01T01:00:00Z"),
    );
    workflow = transitionWorkflow(workflow, "design", {
      now: new Date("2026-01-01T02:00:00Z"),
    });
    workflow = setApproval(workflow, "design", true);
    workflow = transitionWorkflow(workflow, "tasks");
    workflow = setApproval(workflow, "tasks", true);
    workflow = transitionWorkflow(workflow, "implementation");
    expect(() =>
      transitionWorkflow(workflow, "complete", { tasksComplete: false }),
    ).toThrow(/tasks must be complete/i);
    workflow = transitionWorkflow(workflow, "complete", {
      tasksComplete: true,
    });
    expect(WorkflowSchema.parse(workflow).phase).toBe("complete");
  });

  it("enforces ordered bug phases", () => {
    let workflow = createBugWorkflow("failure", "Failure");
    workflow = setApproval(workflow, "report", true) as typeof workflow;
    workflow = transitionWorkflow(workflow, "analysis") as typeof workflow;
    expect(() => transitionWorkflow(workflow, "verification")).toThrow(
      /expected fix/i,
    );
  });
});
