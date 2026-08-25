#!/usr/bin/env node
/**
 * Shrink an interviewer avatar for the web.
 *
 * The Rocketbox exports arrive with every texture at 2048x2048, including the
 * body and clothing — which AvatarStage crops out of frame entirely, since it
 * frames the top ~36% of the bounding box. Decompressed with mipmaps that is
 * roughly 150MB of GPU memory per avatar against the ~60MB the original
 * Ready Player Me model costs, and the mobile path is already fragment-bound.
 *
 * Textures are capped by material role rather than uniformly: the face is the
 * only thing the camera actually sees.
 *
 * Usage:
 *   node scripts/optimize-avatar.mjs public/avatars/*.glb
 *   node scripts/optimize-avatar.mjs --out dist/ public/avatars/alex.glb
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { dedup, prune } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import { basename, join } from "node:path";
import { statSync } from "node:fs";

/**
 * Per-role texture ceilings, in pixels.
 *
 * `head` carries the face, which is the whole point of the render. `body` is
 * clothing and skin below the collar; at default framing it is off-screen, and
 * even at portrait framing it is a shoulder. `opacity` is the alpha-blended
 * hair and eyelash card — high frequency, but small on screen.
 */
const ROLE_CAPS = { head: 1024, opacity: 1024, body: 512, default: 512 };

/**
 * Rocketbox names materials `m019_head`, `f005_body.001`, `f002_opacity`.
 * Ready Player Me uses `Wolf3D_Skin`, `Wolf3D_Outfit_Top` and friends, so both
 * conventions are matched — running this over an already-optimized RPM model
 * must not mistake its face for clothing and halve it.
 */
function roleOf(materialName) {
  const name = (materialName || "").toLowerCase();
  if (/outfit|footwear|body/.test(name)) return "body";
  if (/head|skin|eye|teeth|tongue/.test(name)) return "head";
  if (/opacity|hair|glasses|lash/.test(name)) return "opacity";
  return "default";
}

/**
 * Every material that uses a texture, found through the property graph rather
 * than a list of known getters.
 *
 * These files carry KHR_materials_specular, whose maps hang off an extension
 * property rather than the Material itself. Enumerating getters missed those
 * and quietly gave the *face* specular map the body's cap, so the walk climbs
 * one level out of any extension property it lands on.
 */
function materialsUsing(texture) {
  const found = new Set();
  for (const parent of texture.listParents()) {
    if (parent.propertyType === "Material") {
      found.add(parent);
      continue;
    }
    if (parent.propertyType === "Root") continue;
    for (const grandparent of parent.listParents?.() ?? []) {
      if (grandparent.propertyType === "Material") found.add(grandparent);
    }
  }
  return found;
}

async function optimize(path, outDir) {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

  const before = statSync(path).size;
  const document = await io.read(path);
  const root = document.getRoot();

  // Drop unreferenced textures before resizing them. Every one of these files
  // ships one or two 2048x2048 images no material points at.
  await document.transform(prune(), dedup());

  // A single-keyframe animation is a baked rest pose. AvatarStage never
  // constructs an AnimationMixer, so it is pure download weight.
  for (const animation of root.listAnimations()) {
    const keyframes = Math.max(
      0,
      ...animation.listSamplers().map((sampler) => sampler.getInput()?.getCount() ?? 0)
    );
    if (keyframes <= 1) animation.dispose();
  }

  let saved = 0;
  for (const texture of root.listTextures()) {
    const image = texture.getImage();
    if (!image) continue;

    // The most generous role wins: a texture shared between the face and the
    // body has to stay at face quality.
    const roles = [...materialsUsing(texture)].map((material) => roleOf(material.getName()));
    const cap = roles.length
      ? Math.max(...roles.map((role) => ROLE_CAPS[role]))
      : ROLE_CAPS.default;
    const { width, height } = await sharp(image).metadata();
    if (width <= cap && height <= cap) continue;

    // `fit: inside` preserves non-square maps such as ethan's 2048x1024.
    const resized = await sharp(image)
      .resize(cap, cap, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90, effort: 6 })
      .toBuffer();

    saved += image.byteLength - resized.byteLength;
    texture.setImage(resized).setMimeType("image/webp");
  }

  // Re-apply meshopt. Reading decompressed the buffer views, so without this
  // the output is larger than the input however much texture we removed.
  document
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

  const target = outDir ? join(outDir, basename(path)) : path;
  await io.write(target, document);

  const after = statSync(target).size;
  const mb = (bytes) => `${(bytes / 1048576).toFixed(2)}MB`;
  console.log(
    `${basename(path).padEnd(20)} ${mb(before)} -> ${mb(after)}  ` +
      `(-${Math.round((1 - after / before) * 100)}%, textures -${mb(saved)})`
  );
}

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outDir = outIndex === -1 ? null : args[outIndex + 1];
// Guard the -1 case explicitly: `outIndex + 1` is 0 when --out is absent, which
// would drop the first filename.
const files = args.filter(
  (arg, i) => !arg.startsWith("--") && !(outIndex !== -1 && i === outIndex + 1)
);

if (files.length === 0) {
  console.error("usage: node scripts/optimize-avatar.mjs [--out DIR] <file.glb...>");
  process.exit(1);
}

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
for (const file of files) await optimize(file, outDir);
