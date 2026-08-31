import path from "node:path";

import { WORKFLOW_ROOT } from "./constants.js";
import { exists, readUtf8 } from "./fs-safe.js";
import { resolveInside } from "./paths.js";
import type { WorkflowKind } from "./schemas.js";
import { workflowDirectory } from "./workflow-store.js";

interface ContextSection {
  title: string;
  filePath: string;
}

async function loadSections(
  projectRoot: string,
  sections: ContextSection[],
): Promise<string> {
  const output: string[] = [];
  for (const section of sections) {
    if (!(await exists(section.filePath))) continue;
    const content = (await readUtf8(section.filePath)).trim();
    if (content) {
      output.push(
        `## ${section.title}\n\n_Source: ${path.relative(projectRoot, section.filePath)}_\n\n${content}`,
      );
    }
  }
  return output.join("\n\n---\n\n");
}

export async function loadSteeringContext(
  projectRoot: string,
): Promise<string> {
  const steering = resolveInside(projectRoot, WORKFLOW_ROOT, "steering");
  const content = await loadSections(projectRoot, [
    {
      title: "Product steering",
      filePath: resolveInside(steering, "product.md"),
    },
    {
      title: "Technology steering",
      filePath: resolveInside(steering, "tech.md"),
    },
    {
      title: "Structure steering",
      filePath: resolveInside(steering, "structure.md"),
    },
  ]);
  return content || "## Steering context\n\nNo steering documents are present.";
}

export async function loadWorkflowContext(
  projectRoot: string,
  kind: WorkflowKind,
  name: string,
): Promise<string> {
  const directory = workflowDirectory(projectRoot, kind, name);
  const workflowSections: ContextSection[] =
    kind === "spec"
      ? [
          {
            title: "Requirements",
            filePath: resolveInside(directory, "requirements.md"),
          },
          { title: "Design", filePath: resolveInside(directory, "design.md") },
          { title: "Tasks", filePath: resolveInside(directory, "tasks.md") },
        ]
      : [
          {
            title: "Bug report",
            filePath: resolveInside(directory, "report.md"),
          },
          {
            title: "Bug analysis",
            filePath: resolveInside(directory, "analysis.md"),
          },
          { title: "Fix record", filePath: resolveInside(directory, "fix.md") },
          {
            title: "Verification",
            filePath: resolveInside(directory, "verification.md"),
          },
        ];
  const [steering, workflow] = await Promise.all([
    loadSteeringContext(projectRoot),
    loadSections(projectRoot, workflowSections),
  ]);
  return `${steering}\n\n---\n\n${workflow || `## ${kind} context\n\nNo workflow documents are present.`}`;
}
