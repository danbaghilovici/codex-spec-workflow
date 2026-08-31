import { createHash, randomBytes } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  open,
  readFile,
  rename,
  stat,
} from "node:fs/promises";
import path from "node:path";

import { WORKFLOW_ROOT } from "./constants.js";
import { relativeInside, resolveInside } from "./paths.js";

export async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readUtf8(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

export function checksum(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function checksumFile(filePath: string): Promise<string> {
  return checksum(await readFile(filePath));
}

export interface AtomicWriteOptions {
  backup?: boolean;
  projectRoot?: string;
  mode?: number;
}

export async function backupFile(
  filePath: string,
  projectRoot: string,
): Promise<string | undefined> {
  if (!(await exists(filePath))) return undefined;
  const relative = relativeInside(projectRoot, filePath);
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const nonce = randomBytes(3).toString("hex");
  const destination = resolveInside(
    projectRoot,
    WORKFLOW_ROOT,
    "backups",
    `${stamp}-${nonce}`,
    relative,
  );
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(filePath, destination);
  return destination;
}

export async function atomicWrite(
  filePath: string,
  content: string,
  options: AtomicWriteOptions = {},
): Promise<void> {
  const absolute = path.resolve(filePath);
  if (options.projectRoot) relativeInside(options.projectRoot, absolute);
  await mkdir(path.dirname(absolute), { recursive: true });
  if (options.backup && options.projectRoot)
    await backupFile(absolute, options.projectRoot);

  const temp = `${absolute}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
  const handle = await open(temp, "wx", options.mode ?? 0o644);
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temp, absolute);

  try {
    const directory = await open(path.dirname(absolute), "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } catch {
    // Some platforms do not permit syncing directory handles; the file rename is still atomic.
  }
}

export async function isDirectory(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}
