import { copyFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const packagePath = join(process.cwd(), "package.json");
const developmentPath = join(process.cwd(), "package.dev.json");

if (existsSync(developmentPath)) {
  copyFileSync(developmentPath, packagePath);
  rmSync(developmentPath);
}
