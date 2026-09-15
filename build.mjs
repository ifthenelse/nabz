import * as esbuild from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

const watch = process.argv.includes("--watch");
const outdir = "dist";

const entryPoints = [
  { in: "src/background/service-worker.ts", out: "background/service-worker" },
  { in: "src/popup/popup.ts", out: "popup/popup" },
  { in: "src/devtools/devtools.ts", out: "devtools/devtools" },
  { in: "src/devtools/panel.ts", out: "devtools/panel" },
];

const staticFiles = [
  ["manifest.json", "manifest.json"],
  ["src/styles/theme.css", "styles/theme.css"],
  ["src/popup/popup.html", "popup/popup.html"],
  ["src/popup/popup.css", "popup/popup.css"],
  ["src/devtools/devtools.html", "devtools/devtools.html"],
  ["src/devtools/panel.html", "devtools/panel.html"],
  ["src/devtools/panel.css", "devtools/panel.css"],
];

async function copyStatic() {
  for (const [from, to] of staticFiles) {
    const dest = `${outdir}/${to}`;
    await mkdir(dest.substring(0, dest.lastIndexOf("/")), { recursive: true });
    await cp(from, dest);
  }
}

async function main() {
  if (existsSync(outdir)) {
    await rm(outdir, { recursive: true });
  }
  await mkdir(outdir, { recursive: true });
  await copyStatic();

  const ctx = await esbuild.context({
    entryPoints,
    entryNames: "[dir]/[name]",
    outdir,
    bundle: true,
    format: "esm",
    target: "chrome116",
    sourcemap: true,
    logLevel: "info",
  });

  if (watch) {
    await ctx.watch();
    console.log("Watching for changes...");
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
