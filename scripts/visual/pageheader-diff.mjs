#!/usr/bin/env node
/**
 * PageHeader visual regression harness.
 *
 * Captures a clipped screenshot of the <PageHeader> region on each key route
 * and diffs it against a stored baseline using pixelmatch. Fails (exit 1) if
 * any route exceeds the per-route mismatch threshold.
 *
 * Usage:
 *   node scripts/visual/pageheader-diff.mjs                # diff vs baselines
 *   node scripts/visual/pageheader-diff.mjs --update       # write/refresh baselines
 *   BASE_URL=https://your.preview.app node scripts/visual/pageheader-diff.mjs
 *
 * Requirements (devDependencies):
 *   playwright, pixelmatch, pngjs
 *
 * The header region is identified by [data-visual-id="page-header"], which is
 * rendered by src/components/PageHeader.tsx.
 */

import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const BASELINE_DIR = path.join(ROOT, "scripts/visual/baselines");
const ACTUAL_DIR = path.join(ROOT, "scripts/visual/actual");
const DIFF_DIR = path.join(ROOT, "scripts/visual/diff");

const BASE_URL = process.env.BASE_URL || "http://localhost:8080";
const UPDATE = process.argv.includes("--update");
// Allow up to 0.5% pixel mismatch per route. Tune if anti-aliasing wiggles.
const MAX_MISMATCH_RATIO = 0.005;

// App targets ≥768px (see mem://constraints/viewport-support). Mobile is
// intentionally unsupported, so the diff sweep starts at tablet width.
const VIEWPORTS = [
  { name: "tablet",  width: 768,  height: 1024 },
  { name: "laptop",  width: 1366, height: 768  },
  { name: "wide",    width: 1920, height: 1080 },
];

const ROUTES = [
  { name: "office",       path: "/" },
  { name: "tasks",        path: "/tasks" },
  { name: "agents",       path: "/agents" },
  { name: "plans",        path: "/plans" },
  { name: "jobs",         path: "/jobs" },
  { name: "inbox",        path: "/inbox" },
  { name: "analytics",    path: "/analytics" },
  { name: "deliverables", path: "/deliverables" },
  { name: "integrations", path: "/integrations" },
];

for (const dir of [BASELINE_DIR, ACTUAL_DIR, DIFF_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

async function captureHeader(page, route) {
  await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle" });
  // Disable motion so framer-motion entrance doesn't race the screenshot.
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }`,
  });
  const handle = await page.waitForSelector('[data-visual-id="page-header"]', {
    timeout: 5000,
  });
  // Settle one frame after motion is killed.
  await page.waitForTimeout(150);
  const buf = await handle.screenshot({ type: "png" });
  return buf;
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  });
  const page = await context.newPage();

  const results = [];
  for (const route of ROUTES) {
    const slug = `${viewport.name}__${route.name}`;
    const actualPath = path.join(ACTUAL_DIR, `${slug}.png`);
    const baselinePath = path.join(BASELINE_DIR, `${slug}.png`);
    const diffPath = path.join(DIFF_DIR, `${slug}.png`);

    let buf;
    try {
      buf = await captureHeader(page, route);
    } catch (err) {
      results.push({ slug, status: "error", message: err.message });
      continue;
    }
    fs.writeFileSync(actualPath, buf);

    if (UPDATE || !fs.existsSync(baselinePath)) {
      fs.writeFileSync(baselinePath, buf);
      results.push({ slug, status: UPDATE ? "updated" : "created" });
      continue;
    }

    const actual = PNG.sync.read(buf);
    const baseline = loadPng(baselinePath);

    if (actual.width !== baseline.width || actual.height !== baseline.height) {
      results.push({
        slug,
        status: "fail",
        message: `size mismatch baseline=${baseline.width}x${baseline.height} actual=${actual.width}x${actual.height}`,
      });
      continue;
    }

    const { width, height } = actual;
    const diff = new PNG({ width, height });
    const mismatched = pixelmatch(
      baseline.data,
      actual.data,
      diff.data,
      width,
      height,
      { threshold: 0.1, includeAA: false },
    );
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    const ratio = mismatched / (width * height);
    const status = ratio > MAX_MISMATCH_RATIO ? "fail" : "pass";
    results.push({
      slug,
      status,
      mismatchedPixels: mismatched,
      ratio: +(ratio * 100).toFixed(3),
    });
  }

  await context.close();
  return results;
}

async function main() {
  const browser = await chromium.launch();

  const allResults = [];
  for (const viewport of VIEWPORTS) {
    const r = await runViewport(browser, viewport);
    allResults.push(...r);
  }

  await browser.close();

  console.log("\nPageHeader visual diff (tablet → wide; mobile excluded by policy)");
  console.log("─────────────────────────────────────────────────────────────────");
  for (const r of allResults) {
    const tag = r.status.toUpperCase().padEnd(7);
    const extra =
      r.status === "pass" || r.status === "fail"
        ? ` ${r.ratio}% (${r.mismatchedPixels}px)`
        : r.message
        ? ` ${r.message}`
        : "";
    console.log(`${tag} ${r.slug}${extra}`);
  }

  const failed = allResults.filter((r) => r.status === "fail" || r.status === "error");
  if (failed.length) {
    console.log(`\n${failed.length} capture(s) failed. See scripts/visual/diff/*.png`);
    process.exit(1);
  }
  console.log("\nAll routes within tolerance across all viewports.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
