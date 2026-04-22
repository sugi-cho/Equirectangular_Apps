#!/usr/bin/env node
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const inputPath = resolve(
  args.input ?? resolve(process.cwd(), "..", "..", "..", "STmap_and_Projection_Project", "R0_S00_00_Template_STMap_24k.exr"),
);
const outputDirs = [
  resolve(args.out ?? resolve(process.cwd(), "public", "stmap", "current")),
  resolve(process.cwd(), "..", "editor", "public", "stmap", "current"),
  resolve(process.cwd(), "..", "..", "..", "public", "stmap", "current"),
];

for (const outputDir of outputDirs) {
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
}

const helperPath = resolve(process.cwd(), "scripts", "build-stmap.py");
const commandArgs = [helperPath, "--input", inputPath];
for (const outputDir of outputDirs) {
  commandArgs.push("--out", outputDir);
}

const result = spawnSync("python", commandArgs, {
  encoding: "utf8",
});

if (result.status !== 0) {
  throw new Error(result.stderr || result.stdout || "build-stmap.py failed");
}

process.stdout.write(result.stdout);

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const entry = argv[i];
    if (!entry.startsWith("--")) {
      continue;
    }
    const key = entry.slice(2);
    const value = argv[i + 1];
    if (value && !value.startsWith("--")) {
      result[key] = value;
      i += 1;
    } else {
      result[key] = "true";
    }
  }
  return result;
}
