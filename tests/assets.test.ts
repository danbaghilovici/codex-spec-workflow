import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SKILL_NAMES, TEMPLATE_NAMES } from "../src/constants.js";

const root = path.resolve(import.meta.dirname, "..");

describe("skill, agent, and plugin contracts", () => {
  it("has valid canonical skills without stale Claude paths or slash commands", async () => {
    for (const name of SKILL_NAMES) {
      const content = await readFile(
        path.join(root, "skills", name, "SKILL.md"),
        "utf8",
      );
      expect(content).toMatch(new RegExp(`^---\\nname: ${name}\\n`));
      expect(content).toMatch(/\ndescription: .+\n---\n/);
      expect(content).not.toContain(".claude/");
      expect(content).not.toMatch(/`\/(?:spec|bug)-/);

      const metadata = await readFile(
        path.join(root, "skills", name, "agents", "openai.yaml"),
        "utf8",
      );
      expect(metadata).toContain('interface:\n  display_name: "');
      expect(metadata).toContain('\n  short_description: "');
      expect(metadata).toContain(
        "\npolicy:\n  allow_implicit_invocation: false\n",
      );
    }
  });

  it("keeps one complete canonical template set", async () => {
    const directory = path.join(
      root,
      "skills",
      "spec-create",
      "assets",
      "templates",
    );
    const actual = (await readdir(directory)).sort();
    expect(actual).toEqual([...TEMPLATE_NAMES].sort());
  });

  it("plugin manifest points at the canonical skill tree", async () => {
    const manifest = JSON.parse(
      await readFile(path.join(root, ".codex-plugin", "plugin.json"), "utf8"),
    ) as unknown as { name: string; skills: string };
    expect(manifest).toMatchObject({
      name: "codex-spec-workflow",
      skills: "./skills/",
    });
  });
});
