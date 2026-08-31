import { fileURLToPath } from "node:url";
import path from "node:path";

import { exists } from "./fs-safe.js";
import { WorkflowError } from "./errors.js";

export async function findPackageRoot(
  start = path.dirname(fileURLToPath(import.meta.url)),
): Promise<string> {
  let candidate = path.resolve(start);
  for (;;) {
    if (
      (await exists(path.join(candidate, ".codex-plugin", "plugin.json"))) &&
      (await exists(path.join(candidate, "skills")))
    ) {
      return candidate;
    }
    const parent = path.dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }
  throw new WorkflowError(
    "Could not locate packaged skills and plugin metadata.",
  );
}
