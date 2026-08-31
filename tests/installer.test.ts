import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { installWorkflow } from "../src/installer.js";

const packageRoot = path.resolve(import.meta.dirname, "..");

describe("safe installer", () => {
  it("installs managed files while preserving unrelated guidance and extensions", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-spec-install-"));
    await mkdir(path.join(root, ".agents", "skills", "custom-skill"), {
      recursive: true,
    });
    await writeFile(
      path.join(root, "AGENTS.md"),
      "# Existing guidance\n\nKeep this.\n",
    );
    await writeFile(
      path.join(root, ".agents", "skills", "custom-skill", "SKILL.md"),
      "custom",
    );

    const result = await installWorkflow(root, { packageRoot });
    expect(
      result.actions.some(
        (action) => action.path === ".agents/skills/spec-create/SKILL.md",
      ),
    ).toBe(true);
    expect(
      result.actions.some(
        (action) =>
          action.path === ".agents/skills/spec-create/agents/openai.yaml",
      ),
    ).toBe(true);
    expect(
      await readFile(
        path.join(
          root,
          ".agents",
          "skills",
          "spec-create",
          "agents",
          "openai.yaml",
        ),
        "utf8",
      ),
    ).toContain("policy:\n  allow_implicit_invocation: false\n");
    const agents = await readFile(path.join(root, "AGENTS.md"), "utf8");
    expect(agents).toContain("Keep this.");
    expect(agents).toContain(
      "only after the user explicitly invokes an installed skill whose name starts with",
    );
    expect(agents).toContain("`$spec-` or `$bug-`");
    expect(agents).toContain(
      "Neither existing `.codex-specs/` content nor a request matching a registered",
    );
    expect(agents).toContain(
      "Without an explicit workflow skill mention, do not initiate",
    );
    expect(agents).toContain(
      "Continue through multiple tasks sequentially only when",
    );
    expect(agents).toContain("the user explicitly requests them together");
    expect(
      await readFile(
        path.join(root, ".agents", "skills", "custom-skill", "SKILL.md"),
        "utf8",
      ),
    ).toBe("custom");
  });

  it("preserves customized managed files on update", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-spec-update-"));
    await installWorkflow(root, { packageRoot });
    const skill = path.join(
      root,
      ".agents",
      "skills",
      "spec-status",
      "SKILL.md",
    );
    await writeFile(skill, "user customization\n");
    const result = await installWorkflow(root, { packageRoot });
    expect(result.actions).toContainEqual(
      expect.objectContaining({
        path: ".agents/skills/spec-status/SKILL.md",
        status: "preserve",
      }),
    );
    expect(result.manifest.preserved).toContain(
      ".agents/skills/spec-status/SKILL.md",
    );
    expect(await readFile(skill, "utf8")).toBe("user customization\n");
  });

  it("has a truly write-free dry run", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "codex-spec-dry-"));
    await installWorkflow(root, { packageRoot, dryRun: true });
    await expect(
      readFile(path.join(root, ".codex-specs", "install.json")),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
