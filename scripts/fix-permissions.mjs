import { chmod } from "node:fs/promises";

await Promise.all(
  ["dist/cli.js", "dist/dashboard/cli.js"].map((file) => chmod(file, 0o755)),
);
