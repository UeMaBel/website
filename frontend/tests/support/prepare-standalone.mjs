import { cp, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const frontendRoot = process.cwd();
const staticDirectory = resolve(frontendRoot, ".next/static");
const standaloneStaticDirectory = resolve(frontendRoot, ".next/standalone/.next/static");

try {
  await stat(staticDirectory);
} catch {
  throw new Error("Build the frontend before running the browser accessibility checks.");
}

await mkdir(dirname(standaloneStaticDirectory), { recursive: true });
await cp(staticDirectory, standaloneStaticDirectory, { recursive: true, force: true });
