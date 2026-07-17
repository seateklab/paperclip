import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { buildPluginWorkerExecArgv } from "../services/plugin-loader.js";

describe("buildPluginWorkerExecArgv", () => {
  it("passes the development tsx loader as a file URL", () => {
    const loaderPath = process.platform === "win32"
      ? "D:\\Paperclip\\cli\\node_modules\\tsx\\dist\\loader.mjs"
      : "/tmp/paperclip/cli/node_modules/tsx/dist/loader.mjs";

    expect(
      buildPluginWorkerExecArgv({
        packagePath: "D:\\Paperclip\\packages\\plugins\\plugin-kie-image",
        loaderPath,
      }),
    ).toEqual(["--import", pathToFileURL(loaderPath).href]);
  });

  it("does not add a loader for non-local plugin installs", () => {
    expect(
      buildPluginWorkerExecArgv({
        packagePath: null,
        loaderPath: "D:\\Paperclip\\cli\\node_modules\\tsx\\dist\\loader.mjs",
      }),
    ).toBeUndefined();
  });
});
