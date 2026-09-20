/**
 * Pixel-level visual regression comparison tool using sharp.
 *
 * Validates that both before/ and after/ directories contain the exact set of 20
 * expected screenshot files, computes channel-by-channel pixel diffs, and asserts
 * that visual variance remains strictly below the 0.05% threshold.
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const BEFORE_DIR = path.resolve(process.cwd(), "scratch/screenshots/before");
const AFTER_DIR = path.resolve(process.cwd(), "scratch/screenshots/after");

const routes = ["home", "blog", "blog-post", "privacy", "terms"];
const viewports = ["desktop", "mobile"];
const themes = ["dark", "light"];

const expectedFiles = routes.flatMap((r) =>
  viewports.flatMap((v) => themes.map((t) => `${r}-${v}-${t}.png`))
);

async function compareImages(file) {
  const beforeFile = path.join(BEFORE_DIR, file);
  const afterFile = path.join(AFTER_DIR, file);

  const beforeImg = sharp(beforeFile);
  const afterImg = sharp(afterFile);

  const [beforeMeta, afterMeta] = await Promise.all([beforeImg.metadata(), afterImg.metadata()]);

  if (beforeMeta.width !== afterMeta.width || beforeMeta.height !== afterMeta.height) {
    return {
      file,
      match: false,
      error: `Dimension mismatch: ${beforeMeta.width}x${beforeMeta.height} vs ${afterMeta.width}x${afterMeta.height}`
    };
  }

  const [beforeRaw, afterRaw] = await Promise.all([
    beforeImg.raw().toBuffer(),
    afterImg.raw().toBuffer()
  ]);

  let diffPixels = 0;
  const totalPixels = beforeMeta.width * beforeMeta.height;
  const channels = beforeMeta.channels || 3;

  for (let i = 0; i < beforeRaw.length; i += channels) {
    const dr = Math.abs(beforeRaw[i] - afterRaw[i]);
    const dg = Math.abs(beforeRaw[i + 1] - afterRaw[i + 1]);
    const db = Math.abs(beforeRaw[i + 2] - afterRaw[i + 2]);
    if (dr > 2 || dg > 2 || db > 2) {
      diffPixels++;
    }
  }

  const diffPercent = (diffPixels / totalPixels) * 100;
  return {
    file,
    match: diffPercent < 0.05,
    diffPercent: diffPercent.toFixed(4) + "%",
    diffPixels,
    totalPixels
  };
}

async function run() {
  if (!fs.existsSync(BEFORE_DIR)) {
    console.error(`Missing before directory: ${BEFORE_DIR}`);
    process.exit(1);
  }
  if (!fs.existsSync(AFTER_DIR)) {
    console.error(`Missing after directory: ${AFTER_DIR}`);
    process.exit(1);
  }

  const beforeFiles = new Set(fs.readdirSync(BEFORE_DIR).filter((f) => f.endsWith(".png")));
  const afterFiles = new Set(fs.readdirSync(AFTER_DIR).filter((f) => f.endsWith(".png")));

  // Verify file set completeness and symmetry
  let fileSetError = false;
  for (const expected of expectedFiles) {
    if (!beforeFiles.has(expected)) {
      console.error(`Missing file in before/: ${expected}`);
      fileSetError = true;
    }
    if (!afterFiles.has(expected)) {
      console.error(`Missing file in after/: ${expected}`);
      fileSetError = true;
    }
  }

  for (const f of beforeFiles) {
    if (!expectedFiles.includes(f)) {
      console.error(`Unexpected file in before/: ${f}`);
      fileSetError = true;
    }
    if (!afterFiles.has(f)) {
      console.error(`File exists in before/ but missing from after/: ${f}`);
      fileSetError = true;
    }
  }
  for (const f of afterFiles) {
    if (!expectedFiles.includes(f)) {
      console.error(`Unexpected file in after/: ${f}`);
      fileSetError = true;
    }
    if (!beforeFiles.has(f)) {
      console.error(`File exists in after/ but missing from before/: ${f}`);
      fileSetError = true;
    }
  }

  if (fileSetError) {
    console.error(
      "File set validation failed. Both directories must contain matching expected files."
    );
    process.exit(1);
  }

  console.log(`Comparing ${expectedFiles.length} screenshots between before/ and after/...`);

  let allPassed = true;
  for (const file of expectedFiles) {
    const res = await compareImages(file);
    if (res.error) {
      console.log(`❌ ${file}: ${res.error}`);
      allPassed = false;
    } else if (!res.match) {
      console.log(
        `⚠️ ${file}: diff ${res.diffPercent} (${res.diffPixels} / ${res.totalPixels} px)`
      );
      allPassed = false;
    } else {
      console.log(`✅ ${file}: identical (${res.diffPercent} diff)`);
    }
  }

  if (!allPassed) {
    console.error("\nSome visual comparisons exceeded threshold!");
    process.exit(1);
  } else {
    console.log("\nAll visual comparisons passed! Zero unintended visual regressions.");
  }
}

run().catch((err) => {
  console.error("Unexpected failure during comparison:", err);
  process.exit(1);
});
